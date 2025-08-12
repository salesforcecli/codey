/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CountTokensResponse,
  GenerateContentResponse,
  GenerateContentParameters,
  CountTokensParameters,
  EmbedContentResponse,
  EmbedContentParameters,
  Content,
  Part,
  Candidate,
  ContentListUnion,
  ContentUnion,
} from '@google/genai';
import { GatewayClient, ChatGenerations, GatewayResponse } from './client.js';
import { ContentGenerator } from '../core/contentGenerator.js';
import { Claude37Sonnet } from './models.js';

const isString = (content: ContentUnion): content is string =>
  typeof content === 'string';

const isPart = (content: ContentUnion): content is Part =>
  typeof content === 'object' &&
  content !== null &&
  ('text' in content || 'inlineData' in content || 'fileData' in content);

const isContent = (content: ContentUnion): content is Content =>
  typeof content === 'object' && content !== null && 'parts' in content;

/**
 * Maps Gateway parameter names to the expected tool parameter names
 */
const mapToolParameters = (
  toolName: string,
  args: Record<string, unknown>,
): Record<string, unknown> => {
  const mappedArgs = { ...args };

  switch (toolName) {
    case 'read_file':
      if ('file_path' in mappedArgs) {
        mappedArgs.absolute_path = mappedArgs.file_path;
        delete mappedArgs.file_path;
      }
      break;
    default:
      // No parameter mapping needed for other tools
      break;
  }

  return mappedArgs;
};

const convertGenerationToCandidate = (
  generation: NonNullable<
    ChatGenerations['generation_details']
  >['generations'][number],
): Candidate => {
  const parts: Part[] = [];

  // Add text content if present
  if (generation.content) {
    parts.push({ text: generation.content });
  }

  // Add tool calls if present
  if (generation.tool_invocations && generation.tool_invocations.length > 0) {
    for (const toolInvocation of generation.tool_invocations) {
      const rawArgs = JSON.parse(toolInvocation.function.arguments);
      const mappedArgs = mapToolParameters(
        toolInvocation.function.name,
        rawArgs,
      );

      parts.push({
        functionCall: {
          name: toolInvocation.function.name,
          args: mappedArgs,
        },
      });
    }
  }

  return {
    content: {
      parts,
      role: 'model',
    },
    index: 0,
    safetyRatings: [], // Gateway doesn't provide safety ratings in the same format
  };
};

/**
 * ContentGenerator implementation that uses Salesforce LLM Gateway
 */
export class GatewayContentGenerator implements ContentGenerator {
  private client: GatewayClient;
  // Default to Claude37Sonnet model for now - this could be made configurable
  model = Claude37Sonnet;

  constructor() {
    this.client = new GatewayClient({
      model: this.model,
    });
  }

  async generateContent(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<GenerateContentResponse> {
    const gatewayRequest = this.prepareGatewayRequest(request);
    const response = await this.client.generateChatCompletion(gatewayRequest);

    // Convert Gateway response back to Gemini format
    return this.convertGatewayResponseToGemini(response);
  }

  async generateContentStream(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const gatewayRequest = this.prepareGatewayRequest(request);
    const streamGenerator =
      await this.client.generateChatCompletionStream(gatewayRequest);

    return this.convertStreamGeneratorToGemini(streamGenerator);
  }

  async countTokens(
    request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    // Gateway doesn't have a direct token counting endpoint
    // Provide an estimation based on rough character count
    const prompt = this.convertContentsToPrompt(request.contents);
    const estimatedTokens = Math.ceil(prompt.length / 4); // Rough estimation: 1 token ≈ 4 characters

    return {
      totalTokens: estimatedTokens,
    };
  }

  async embedContent(
    request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    // Convert content to text - handle ContentListUnion properly
    const contentArray = this.toContentsArray(request.contents);
    const text = this.convertContentToText(contentArray[0]);

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
              (response.data as Record<string, unknown>)?.embeddings as Array<
                Record<string, unknown>
              >
            )?.[0]?.values as number[]) || [],
        },
      ],
    };
  }

  /**
   * Convert Gemini Contents array to a single prompt string
   */
  private convertContentsToPrompt(contents: ContentListUnion): string {
    const contentArray = this.toContentsArray(contents);
    return contentArray
      .map((content) =>
        content.parts
          ?.map((part) => {
            if ('text' in part && part.text) {
              return part.text;
            }
            // Handle other part types if needed (images, etc.)
            return '';
          })
          .join(' '),
      )
      .join('\n');
  }

  /**
   * Convert ContentListUnion to Content array (similar to converter.ts)
   */
  private toContentsArray(contents: ContentListUnion): Content[] {
    if (Array.isArray(contents)) {
      return contents.map(this.toContent.bind(this));
    }
    return [this.toContent(contents)];
  }

  /**
   * Convert ContentUnion to Content (similar to converter.ts)
   */
  private toContent(content: ContentUnion): Content {
    if (Array.isArray(content)) {
      // it's a PartsUnion[]
      return {
        role: 'user',
        parts: content.map((part) =>
          typeof part === 'string' ? { text: part } : part,
        ),
      };
    }
    if (typeof content === 'string') {
      return {
        role: 'user',
        parts: [{ text: content }],
      };
    }
    // Check if it's a Part (has properties like text, but not role)
    if ('text' in content && !('role' in content)) {
      return {
        role: 'user',
        parts: [content],
      };
    }
    // it's already a Content object
    return content as Content;
  }

  private prepareGatewayRequest(request: GenerateContentParameters) {
    const messages: Array<{
      role: 'system' | 'user' | 'assistant' | 'tool';
      content: string;
    }> = [];

    // Add system instruction if present
    if (request.config?.systemInstruction) {
      messages.push({
        role: 'system',
        content: this.convertContentToText(request.config.systemInstruction),
      });
    }

    // Convert contents to messages, preserving roles correctly
    const userContents = this.toContentsArray(request.contents);
    for (const content of userContents) {
      let messageContent = this.convertContentToText(content);

      const role = content.role === 'model' ? 'assistant' : 'user';

      // When JSON output is requested, add instructions to the last user message only
      if (
        request.config?.responseMimeType === 'application/json' &&
        request.config.responseSchema &&
        content === userContents[userContents.length - 1] &&
        role === 'user' // Only add to user messages
      ) {
        const schema = JSON.stringify(request.config.responseSchema, null, 2);
        const jsonInstruction = `

Please respond with a valid JSON object that conforms to the following schema. Do not include any other explanatory text or markdown formatting such as \`\`\`json.

SCHEMA:
${schema}

`;
        messageContent += jsonInstruction;
      }

      messages.push({
        role,
        content: messageContent,
      });
    }

    const gatewayRequest = {
      model: this.model.model,
      messages,
      generation_settings: {
        max_tokens:
          request.config?.maxOutputTokens || this.model.maxOutputTokens,
        temperature: request.config?.temperature || 0.7,
        stop_sequences: request.config?.stopSequences,
      },
    };

    return gatewayRequest;
  }

  /**
   * Convert a single Content to text string
   */
  private convertContentToText(content: ContentUnion): string {
    if (isString(content)) {
      return content;
    }

    if (isPart(content)) {
      return content.text || '';
    }

    if (isContent(content)) {
      return (
        content.parts
          ?.map((part) => this.convertContentToText(part))
          .join(' ') || ''
      );
    }

    if (Array.isArray(content)) {
      return content.map((c) => this.convertContentToText(c)).join('\n');
    }

    return JSON.stringify(content);
  }

  /**
   * Convert Gateway response to Gemini GenerateContentResponse format
   */
  private convertGatewayResponseToGemini(
    chatResponse: GatewayResponse<ChatGenerations>,
  ): GenerateContentResponse {
    const generations = chatResponse.data.generation_details?.generations;
    const candidates = generations?.map(convertGenerationToCandidate);
    const response = new GenerateContentResponse();
    response.candidates = candidates;
    response.usageMetadata = {
      promptTokenCount: 0,
      candidatesTokenCount: 0,
      totalTokenCount: 0,
    };
    response.modelVersion = this.model.model;
    return response;
  }

  /**
   * Convert streaming Gateway generator to Gemini format
   */
  private async *convertStreamGeneratorToGemini(
    streamGenerator: AsyncGenerator<ChatGenerations>,
  ): AsyncGenerator<GenerateContentResponse> {
    for await (const data of streamGenerator) {
      const generations = data.generation_details?.generations;

      const response = new GenerateContentResponse();
      response.candidates = [];
      response.usageMetadata = {
        promptTokenCount: 0,
        candidatesTokenCount: 0,
        totalTokenCount: 0,
      };
      response.modelVersion = this.model.model;
      for (const generation of generations || []) {
        // Include generation if it has content OR tool invocations
        if (
          (generation?.content && generation.content.trim()) ||
          (generation?.tool_invocations &&
            generation.tool_invocations.length > 0)
        ) {
          // Convert each streaming chunk to Gemini format
          const candidate = convertGenerationToCandidate(generation);
          response.candidates.push(candidate);
        }
      }

      yield response;
    }
  }
}
