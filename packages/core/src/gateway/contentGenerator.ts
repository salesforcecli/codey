/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  type CountTokensResponse,
  GenerateContentResponse,
  type GenerateContentParameters,
  type CountTokensParameters,
  type EmbedContentResponse,
  type EmbedContentParameters,
  type Candidate,
} from '@google/genai';
import { GatewayClient } from './client.js';
import {
  type ChatGenerations,
  type GatewayResponse,
  type ChatGenerationRequest,
} from './types.js';
import { type ContentGenerator } from '../core/contentGenerator.js';
import { getModelOrDefault, type GatewayModel } from './models.js';
import {
  toContentsArray,
  convertContentToText,
  convertGeminiToolsToGateway,
  maybeConstructResponseFormat,
  convertGenerationToCandidate,
  handleCompletedStreamingToolCall,
  processGenerationChunks,
  handleTerminalChunk,
  handleIncompleteStreamingToolCall,
  type StreamingToolCall,
  maybeInsertJsonInstructions,
} from './contentGeneratorUtils.js';

/**
 * Gateway-based content generator that implements the ContentGenerator interface.
 * Provides content generation capabilities through the Salesforce LLM Gateway,
 * supporting both streaming and non-streaming responses, token counting, and embeddings.
 *
 * This class serves as an adapter between the Gemini API format and the Gateway API,
 * handling request/response conversion, usage tracking, and streaming operations.
 */
export class GatewayContentGenerator implements ContentGenerator {
  private client: GatewayClient;
  private usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  } = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };

  /**
   * Creates a new GatewayContentGenerator instance.
   * Initializes the Gateway client for communicating with Salesforce LLM Gateway.
   */
  constructor() {
    this.client = new GatewayClient();
  }

  /**
   * Generates content using the Salesforce LLM Gateway.
   *
   * @param request - The content generation request parameters including model, contents, and configuration
   * @param _userPromptId - User prompt identifier (currently unused)
   * @returns Promise resolving to the generated content response
   * @throws Error if the Gateway request fails or response conversion fails
   */
  async generateContent(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<GenerateContentResponse> {
    const model = getModelOrDefault(request.model);
    const gatewayRequest = this.prepareGatewayRequest(request, model);
    const response = await this.client.generateChatCompletion(gatewayRequest);

    // Convert Gateway response back to Gemini format
    return this.convertGatewayResponseToGemini(response, model);
  }

  /**
   * Generates streaming content using the Salesforce LLM Gateway.
   * Returns an async generator that yields content responses as they become available.
   *
   * @param request - The content generation request parameters including model, contents, and configuration
   * @param _userPromptId - User prompt identifier (currently unused)
   * @returns Promise resolving to an async generator of content responses
   * @throws Error if the Gateway streaming request fails or response conversion fails
   */
  async generateContentStream(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const model = getModelOrDefault(request.model);
    const gatewayRequest = this.prepareGatewayRequest(request, model);
    const streamGenerator =
      await this.client.generateChatCompletionStream(gatewayRequest);

    return this.convertStreamGeneratorToGemini(streamGenerator, model);
  }

  /**
   * Counts the tokens used in the conversation so far.
   * Currently returns the total tokens from the last usage calculation.
   *
   * @param _request - Token counting request parameters (currently unused)
   * @returns Promise resolving to the token count response
   */
  async countTokens(
    _request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    return {
      totalTokens: this.usage.totalTokens,
    };
  }

  /**
   * Generates embeddings for the provided content using the Gateway's embedding service.
   * Converts content to text format and creates vector embeddings for semantic similarity.
   *
   * NOTE: This method has not been tested yet.
   *
   * @param request - The embedding request containing content to embed
   * @returns Promise resolving to the embedding response with vector values
   * @throws Error if content conversion fails or embedding request fails
   */
  async embedContent(
    request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    // Convert content to text - handle ContentListUnion properly
    const contentArray = toContentsArray(request.contents);
    const text = convertContentToText(contentArray[0]);

    const embeddingRequest = {
      input: [text],
      model: 'text-embedding-model', // This might need to be adjusted based on available models
    };

    const response = await this.client.createEmbedding(embeddingRequest);

    // Convert to Gemini format
    return {
      embeddings: [
        {
          values:
            ((
              (response.data as Record<string, unknown>)?.[
                'embeddings'
              ] as Array<Record<string, unknown>>
            )?.[0]?.['values'] as number[]) || [],
        },
      ],
    };
  }

  /**
   * Prepares a Gateway API request from Gemini format request parameters.
   * Converts system instructions, user contents, and tools to Gateway format.
   * Handles JSON schema response format configuration.
   *
   * @param request - The Gemini format content generation request
   * @param model - The Gateway model configuration to use
   * @returns Gateway API request object ready for submission
   * @private
   */
  private prepareGatewayRequest(
    request: GenerateContentParameters,
    model: GatewayModel,
  ) {
    const messages: Array<{
      role: 'system' | 'user' | 'assistant' | 'tool';
      content: string;
    }> = [];

    // Add system instruction if present
    if (request.config?.systemInstruction) {
      const systemContent = convertContentToText(
        request.config.systemInstruction,
      );

      messages.push({
        role: 'system',
        content: systemContent,
      });
    }

    // Convert contents to messages, preserving roles correctly
    const userContents = toContentsArray(request.contents);
    for (const content of userContents) {
      const messageContent = convertContentToText(content);
      const role = content.role === 'model' ? 'assistant' : 'user';
      const isLastMessage = content === userContents[userContents.length - 1];
      messages.push({
        role,
        content: maybeInsertJsonInstructions(
          request,
          model,
          messageContent,
          isLastMessage,
        ),
      });
    }

    const tools = convertGeminiToolsToGateway(request.config?.tools ?? []);
    const toolConfig = {
      mode: 'auto',
      parallel_calls: true,
    } satisfies ChatGenerationRequest['tool_config'];

    const responseFormat = maybeConstructResponseFormat(request, model);
    const gatewayRequest = {
      model: model.model,
      messages,
      generation_settings: {
        max_tokens: request.config?.maxOutputTokens ?? model.maxOutputTokens,
        temperature: request.config?.temperature ?? 0.7,
        stop_sequences: request.config?.stopSequences,
        ...(responseFormat
          ? { parameters: { response_format: responseFormat } }
          : {}),
      },
      ...(tools.length > 0 && model.supportsMcp
        ? { tools, tool_config: toolConfig }
        : {}),
    };

    return gatewayRequest;
  }

  /**
   * Extracts and updates usage metrics from the Gateway response.
   * Updates the internal usage tracking with input, output, and total token counts.
   *
   * @param data - The Gateway response data containing usage information
   * @param model - The Gateway model configuration containing usage parameter mappings
   * @private
   */
  private extractUsage(data: ChatGenerations, model: GatewayModel): void {
    const usage = model.extractUsage(data);
    if (usage) {
      this.usage = {
        inputTokens: usage.inputTokens || this.usage.inputTokens,
        outputTokens: usage.outputTokens || this.usage.outputTokens,
        totalTokens: usage.totalTokens || this.usage.totalTokens,
      };
    }
  }

  /**
   * Converts Gateway response to Gemini GenerateContentResponse format.
   * Maps Gateway generations to Gemini candidates and extracts usage metadata.
   *
   * @param chatResponse - The raw Gateway API response containing generations
   * @param model - The Gateway model configuration for usage parameter mapping
   * @returns Converted Gemini format response with candidates and usage metadata
   * @private
   */
  private convertGatewayResponseToGemini(
    chatResponse: GatewayResponse<ChatGenerations>,
    model: GatewayModel,
  ): GenerateContentResponse {
    const generations = chatResponse.data.generation_details?.generations;
    const candidates =
      generations?.map((gen) => convertGenerationToCandidate(gen)) || [];
    this.extractUsage(chatResponse.data, model);

    const response = new GenerateContentResponse();
    response.candidates = candidates;
    response.usageMetadata = {
      promptTokenCount: this.usage.inputTokens,
      candidatesTokenCount: this.usage.outputTokens,
      totalTokenCount: this.usage.totalTokens,
    };
    response.modelVersion = model.model;
    return response;
  }

  /**
   * Converts streaming Gateway generator to Gemini format.
   * Handles streaming tool calls, processes generation chunks, and manages streaming state.
   * Yields individual GenerateContentResponse objects as data becomes available.
   *
   * @param streamGenerator - The async generator from Gateway streaming API
   * @param model - The Gateway model configuration for streaming behavior
   * @returns Async generator yielding Gemini format responses
   * @private
   */
  private async *convertStreamGeneratorToGemini(
    streamGenerator: AsyncGenerator<ChatGenerations>,
    model: GatewayModel,
  ): AsyncGenerator<GenerateContentResponse> {
    const useStreamingToolCalls = model.streamToolCalls === true;
    let activeToolCall: StreamingToolCall | null = null;
    let isFirstContentChunk = true;

    for await (const data of streamGenerator) {
      this.extractUsage(data, model);

      const response = this.createStreamResponse(model);
      const generations = data.generation_details?.generations || [];

      // Transform content if transformer is available
      const processedGenerations = model.transformContent
        ? generations.map((gen) => {
            if (gen.content) {
              const transformedContent = model.transformContent!(
                gen.content,
                isFirstContentChunk,
              );
              isFirstContentChunk = false;
              return { ...gen, content: transformedContent };
            }
            return gen;
          })
        : generations;

      let shouldYieldResponse = false;
      let candidateToYield: Candidate | null = null;

      // Handle completed streaming tool calls
      if (useStreamingToolCalls) {
        const completedCandidate = handleCompletedStreamingToolCall(
          activeToolCall,
          processedGenerations,
        );
        if (completedCandidate) {
          candidateToYield = completedCandidate;
          shouldYieldResponse = true;
          activeToolCall = null;
        }
      }

      // Process current generation chunks (only if we don't already have a completed tool call)
      if (!candidateToYield) {
        const processResult = processGenerationChunks(
          processedGenerations,
          useStreamingToolCalls,
          activeToolCall,
        );

        if (processResult.candidate) {
          candidateToYield = processResult.candidate;
          shouldYieldResponse = true;
        }

        activeToolCall = processResult.updatedActiveToolCall;
      }

      // Handle final usage-only chunks (only if we don't already have a candidate)
      if (!candidateToYield) {
        const finalCandidate = handleTerminalChunk(data, processedGenerations);
        if (finalCandidate) {
          candidateToYield = finalCandidate;
          shouldYieldResponse = true;
        }
      }

      // Yield exactly one candidate per response
      if (shouldYieldResponse && candidateToYield) {
        response.candidates = [candidateToYield];
        yield response;
      }
    }

    handleIncompleteStreamingToolCall(useStreamingToolCalls, activeToolCall);
  }

  /**
   * Creates a base streaming response with usage metadata.
   * Provides a standardized response structure for streaming operations.
   *
   * @param model - The Gateway model configuration for response metadata
   * @returns Base GenerateContentResponse with empty candidates and current usage stats
   * @private
   */
  private createStreamResponse(model: GatewayModel): GenerateContentResponse {
    const response = new GenerateContentResponse();
    response.candidates = [];
    response.usageMetadata = {
      promptTokenCount: this.usage.inputTokens,
      candidatesTokenCount: this.usage.outputTokens,
      totalTokenCount: this.usage.totalTokens,
    };
    response.modelVersion = model.model;
    return response;
  }
}
