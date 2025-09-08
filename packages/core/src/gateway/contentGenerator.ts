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
  type Content,
  type Part,
  type Candidate,
  type ContentListUnion,
  type ContentUnion,
  type ToolListUnion,
  type FinishReason,
} from '@google/genai';
import {
  GatewayClient,
  type ChatGenerations,
  type GatewayResponse,
  type ChatCompletionTool,
  type ChatGenerationRequest,
} from './client.js';
import { type ContentGenerator } from '../core/contentGenerator.js';
import { GPT4oMini, findGatewayModel, type GatewayModel } from './models.js';

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
        mappedArgs['absolute_path'] = mappedArgs['file_path'];
        delete mappedArgs['file_path'];
      }
      break;
    case 'write_file':
      // write_file expects file_path parameter - no mapping needed
      break;
    case 'edit_file':
      // edit_file expects file_path parameter - no mapping needed
      break;
    case 'shell_command':
      // Handle shell parameter mapping if needed
      break;
    // Add more tool-specific mappings as needed
    default:
      break;
  }

  return mappedArgs;
};

/**
 * Type definition for streaming tool call state
 */
type StreamingToolCall = {
  id: string;
  name: string;
  argumentsBuffer: string;
};

const convertGenerationToCandidate = (
  generation: NonNullable<
    ChatGenerations['generation_details']
  >['generations'][number],
  completedToolCalls?: Map<
    string,
    { id: string; name: string; arguments: string }
  >,
): Candidate => {
  const parts: Part[] = [];

  // Add completed tool calls from buffer (streaming case)
  if (completedToolCalls && completedToolCalls.size > 0) {
    for (const [, toolCall] of completedToolCalls) {
      try {
        const rawArgs = JSON.parse(toolCall.arguments);
        const mappedArgs = mapToolParameters(toolCall.name, rawArgs);

        parts.push({
          functionCall: {
            name: toolCall.name,
            args: mappedArgs,
            id: toolCall.id,
          },
        });
      } catch (error) {
        console.error(
          `Failed to parse tool arguments for ${toolCall.name}:`,
          error,
        );
        console.error(`[DEBUG] Raw arguments string: "${toolCall.arguments}"`);
        parts.push({
          text: `Error: Failed to parse tool call ${toolCall.name}`,
        });
      }
    }
  }
  // Handle tool calls directly from generation (non-streaming case)
  else if (
    generation.tool_invocations &&
    generation.tool_invocations.length > 0
  ) {
    for (const toolInvocation of generation.tool_invocations) {
      try {
        const rawArgs = JSON.parse(toolInvocation.function.arguments);
        const mappedArgs = mapToolParameters(
          toolInvocation.function.name,
          rawArgs,
        );

        parts.push({
          functionCall: {
            name: toolInvocation.function.name,
            args: mappedArgs,
            id: toolInvocation.id,
          },
        });
      } catch (error) {
        console.error(
          `Failed to parse tool arguments for ${toolInvocation.function.name}:`,
          error,
        );
        parts.push({
          text: `Error: Failed to parse tool call ${toolInvocation.function.name}`,
        });
      }
    }
  } else if (generation.content) {
    parts.push({ text: generation.content });
  }

  return {
    content: {
      parts,
      role: 'model',
    },
    index: 0,
    safetyRatings: [],
  };
};

/**
 * ContentGenerator implementation that uses Salesforce LLM Gateway
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
  model: GatewayModel;

  constructor({ modelName }: { modelName: string }) {
    this.model = findGatewayModel(modelName) ?? GPT4oMini;
    // need to get the model config from the displayId
    this.client = new GatewayClient({
      model: this.model,
    });
  }

  private recreateClient() {
    this.client = new GatewayClient({ model: this.model });
  }

  private extractUsage(data: ChatGenerations): void {
    const usage = data.generation_details?.parameters?.usage;
    if (usage) {
      this.usage = {
        inputTokens:
          usage[this.model.usageParameters.inputTokens] ||
          this.usage.inputTokens,
        outputTokens:
          usage[this.model.usageParameters.outputTokens] ||
          this.usage.outputTokens,
        totalTokens:
          usage[this.model.usageParameters.totalTokens] ||
          this.usage.totalTokens,
      };
    }
  }

  async generateContent(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<GenerateContentResponse> {
    // Respect per-request model override
    if (request?.model) {
      const m = findGatewayModel(request.model);
      if (m && m.model !== this.model.model) {
        this.model = m as GatewayModel;
        this.recreateClient();
      }
    }
    const gatewayRequest = this.prepareGatewayRequest(request);
    const response = await this.client.generateChatCompletion(gatewayRequest);

    // Convert Gateway response back to Gemini format
    return this.convertGatewayResponseToGemini(response);
  }

  async generateContentStream(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    // Respect per-request model override
    if (request?.model) {
      const m = findGatewayModel(request.model);
      if (m && m.model !== this.model.model) {
        this.model = m as GatewayModel;
        this.recreateClient();
      }
    }
    const gatewayRequest = this.prepareGatewayRequest(request);
    const streamGenerator =
      await this.client.generateChatCompletionStream(gatewayRequest);

    return this.convertStreamGeneratorToGemini(streamGenerator);
  }

  async countTokens(
    _request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    return {
      totalTokens: this.usage.totalTokens,
    };
  }

  // NOTE: This has not been test yet
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
              (response.data as Record<string, unknown>)?.[
                'embeddings'
              ] as Array<Record<string, unknown>>
            )?.[0]?.['values'] as number[]) || [],
        },
      ],
    };
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
      let systemContent = this.convertContentToText(
        request.config.systemInstruction,
      );

      // TODO: use this https://git.soma.salesforce.com/pages/tech-enablement/einstein/docs/gateway/structured-outputs/#structured-outputs-via-response_format
      // If JSON response is requested, add JSON enforcement to system instruction
      if (request.config?.responseMimeType === 'application/json') {
        systemContent = `JSON_MODE: You are operating in strict JSON response mode. You MUST respond with ONLY a valid JSON object. No explanations, no markdown, no text outside the JSON object.

${systemContent}

MANDATORY JSON FORMAT: Your response must be a single JSON object that starts with { and ends with }. Any other format will cause system failure.`;
      }

      messages.push({
        role: 'system',
        content: systemContent,
      });
    }

    // Convert contents to messages, preserving roles correctly
    const userContents = this.toContentsArray(request.contents);
    for (const content of userContents) {
      let messageContent = this.convertContentToText(content);

      const role = content.role === 'model' ? 'assistant' : 'user';

      // When JSON output is requested, add instructions to enforce JSON response
      if (
        request.config?.responseMimeType === 'application/json' &&
        request.config.responseSchema &&
        content === userContents[userContents.length - 1] &&
        role === 'user' // Only add to user messages
      ) {
        const schema = JSON.stringify(request.config.responseSchema, null, 2);
        const jsonInstruction = `

⚠️ JSON_ONLY_MODE: CRITICAL OVERRIDE ⚠️

You are in JSON-ONLY response mode. Your response MUST be valid JSON only.

❌ NO conversational text
❌ NO explanations
❌ NO markdown
❌ NO code blocks
❌ NO "I understand..." or similar phrases

✅ ONLY: Raw JSON object starting with { and ending with }

REQUIRED SCHEMA:
${schema}

FINAL WARNING: Any non-JSON content will cause system failure. Respond with JSON immediately.
`;
        messageContent += jsonInstruction;
      }

      messages.push({
        role,
        content: messageContent,
      });
    }

    const tools = this.convertGeminiToolsToGateway(request.config?.tools ?? []);
    const toolConfig = {
      mode: 'auto',
      parallel_calls: true,
    } satisfies ChatGenerationRequest['tool_config'];

    const gatewayRequest = {
      model: this.model.model,
      messages,
      generation_settings: {
        max_tokens:
          request.config?.maxOutputTokens ?? this.model.maxOutputTokens,
        temperature: request.config?.temperature ?? 0.7,
        stop_sequences: request.config?.stopSequences,
      },
      ...(tools.length > 0 ? { tools, tool_config: toolConfig } : {}),
    };

    return gatewayRequest;
  }

  private convertGeminiToolsToGateway(
    tools: ToolListUnion,
  ): ChatCompletionTool[] {
    const gatewayTools: ChatCompletionTool[] = [];

    for (const tool of tools) {
      // Support both Tool and CallableTool types
      // Tool: has functionDeclarations (array)
      // CallableTool: has 'function' property (single function)
      if (
        'functionDeclarations' in tool &&
        Array.isArray(tool.functionDeclarations)
      ) {
        for (const funcDecl of tool.functionDeclarations) {
          // Normalize the parameter schema to fix type case issues and other inconsistencies
          const normalizedSchema = this.normalizeParameterSchema(
            funcDecl.parametersJsonSchema as Record<string, unknown>,
          );

          gatewayTools.push({
            type: 'function',
            function: {
              name: funcDecl.name || '',
              description: funcDecl.description || '',
              parameters: normalizedSchema,
            },
          });
        }
      } else if ('function' in tool && tool.function) {
        console.log('CallableTool type - skipping for now', tool);
        // CallableTool type - skip for now
        // gatewayTools.push({
        //   type: 'function',
        //   function: {
        //     name: tool.function.name || '',
        //     description: tool.function.description || '',
        //     parameters: tool.function.parametersJsonSchema as Record<string, unknown>,
        //   },
        // });
      }
    }

    return gatewayTools;
  }

  /**
   * Normalizes parameter schema to ensure Gateway API compatibility.
   * Fixes common issues like uppercase type specifications and other schema inconsistencies.
   */
  private normalizeParameterSchema(
    schema: Record<string, unknown>,
  ): Record<string, unknown> {
    if (!schema) return schema;

    // Deep clone to avoid mutating the original schema
    const normalized = JSON.parse(JSON.stringify(schema));

    // Recursively normalize type properties and other schema issues
    const normalizeTypes = (obj: unknown): unknown => {
      if (Array.isArray(obj)) {
        return obj.map(normalizeTypes);
      }

      if (obj && typeof obj === 'object') {
        const result: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(obj)) {
          if (key === 'type' && typeof value === 'string') {
            // Normalize type to lowercase (e.g., 'OBJECT' -> 'object', 'STRING' -> 'string')
            result[key] = value.toLowerCase();
          } else if (typeof value === 'object' && value !== null) {
            result[key] = normalizeTypes(value);
          } else {
            result[key] = value;
          }
        }

        return result;
      }

      return obj;
    };

    return normalizeTypes(normalized) as Record<string, unknown>;
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
    const candidates =
      generations?.map((gen) => convertGenerationToCandidate(gen)) || [];
    this.extractUsage(chatResponse.data);

    const response = new GenerateContentResponse();
    response.candidates = candidates;
    response.usageMetadata = {
      promptTokenCount: this.usage.inputTokens,
      candidatesTokenCount: this.usage.outputTokens,
      totalTokenCount: this.usage.totalTokens,
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
    const useStreamingToolCalls = this.model.streamToolCalls === true;
    let activeToolCall: StreamingToolCall | null = null;

    for await (const data of streamGenerator) {
      this.extractUsage(data);

      const response = this.createStreamResponse();
      const generations = data.generation_details?.generations || [];

      let shouldYieldResponse = false;

      // Handle completed streaming tool calls
      if (useStreamingToolCalls) {
        const completedCandidate = this.handleCompletedStreamingToolCall(
          activeToolCall,
          generations,
        );
        if (completedCandidate) {
          response.candidates!.push(completedCandidate);
          shouldYieldResponse = true;
          activeToolCall = null;
        }
      }

      // Process current generation chunks
      const processResult = this.processGenerationChunks(
        generations,
        useStreamingToolCalls,
        activeToolCall,
      );

      if (processResult.candidates.length > 0) {
        response.candidates!.push(...processResult.candidates);
        shouldYieldResponse = true;
      }

      activeToolCall = processResult.updatedActiveToolCall;

      // Handle final usage-only chunks
      const finalCandidate = this.handleUsageOnlyChunk(data, generations);
      if (finalCandidate) {
        response.candidates = [finalCandidate];
        shouldYieldResponse = true;
      }

      if (shouldYieldResponse) {
        yield response;
      }
    }

    this.handleIncompleteStreamingToolCall(
      useStreamingToolCalls,
      activeToolCall,
    );
  }

  /**
   * Create a base streaming response with metadata
   */
  private createStreamResponse(): GenerateContentResponse {
    const response = new GenerateContentResponse();
    response.candidates = [];
    response.usageMetadata = {
      promptTokenCount: this.usage.inputTokens,
      candidatesTokenCount: this.usage.outputTokens,
      totalTokenCount: this.usage.totalTokens,
    };
    response.modelVersion = this.model.model;
    return response;
  }

  /**
   * Handle completion of streaming tool calls
   */
  private handleCompletedStreamingToolCall(
    activeToolCall: StreamingToolCall | null,
    generations: NonNullable<
      ChatGenerations['generation_details']
    >['generations'],
  ): Candidate | null {
    if (!activeToolCall) return null;

    const hasToolInvocations = generations.some(
      (g) => g?.tool_invocations && g.tool_invocations.length > 0,
    );

    // If we have an active tool call but no tool_invocations in this chunk,
    // it means the tool call streaming is complete
    if (!hasToolInvocations) {
      try {
        const rawArgs = JSON.parse(activeToolCall.argumentsBuffer || '{}');
        const mappedArgs = mapToolParameters(activeToolCall.name, rawArgs);

        return {
          content: {
            parts: [
              {
                functionCall: {
                  name: activeToolCall.name,
                  args: mappedArgs,
                  id: activeToolCall.id,
                },
              },
            ],
            role: 'model',
          },
          index: 0,
          safetyRatings: [],
        };
      } catch {
        return {
          content: {
            parts: [
              {
                text: `Error: Failed to parse tool call ${activeToolCall.name}`,
              },
            ],
            role: 'model',
          },
          index: 0,
          safetyRatings: [],
        };
      }
    }

    return null;
  }

  /**
   * Process generation chunks and return candidates and updated tool call state
   */
  private processGenerationChunks(
    generations: NonNullable<
      ChatGenerations['generation_details']
    >['generations'],
    useStreamingToolCalls: boolean,
    activeToolCall: StreamingToolCall | null,
  ): {
    candidates: Candidate[];
    updatedActiveToolCall: StreamingToolCall | null;
  } {
    const candidates: Candidate[] = [];
    let updatedActiveToolCall = activeToolCall;

    for (const generation of generations) {
      if (
        generation?.tool_invocations &&
        generation.tool_invocations.length > 0
      ) {
        if (useStreamingToolCalls) {
          updatedActiveToolCall = this.handleStreamingToolInvocations(
            generation.tool_invocations,
            updatedActiveToolCall,
          );
        } else {
          const candidate = convertGenerationToCandidate(generation);
          candidates.push(candidate);
        }
      } else if (
        generation?.content !== undefined &&
        generation?.content !== null
      ) {
        candidates.push(this.createTextCandidate(generation.content));
      }
    }

    return { candidates, updatedActiveToolCall };
  }

  /**
   * Handle streaming tool invocations and update active tool call state
   */
  private handleStreamingToolInvocations(
    toolInvocations: NonNullable<
      ChatGenerations['generation_details']
    >['generations'][number]['tool_invocations'],
    activeToolCall: StreamingToolCall | null,
  ): StreamingToolCall | null {
    let updatedActiveToolCall = activeToolCall;

    for (const toolInvocation of toolInvocations || []) {
      // Check if this starts a new tool call (has valid ID and name)
      if (toolInvocation.id && toolInvocation.function.name) {
        updatedActiveToolCall = {
          id: toolInvocation.id,
          name: toolInvocation.function.name,
          argumentsBuffer: toolInvocation.function.arguments || '',
        };
      } else if (
        updatedActiveToolCall &&
        (!toolInvocation.id || !toolInvocation.function.name)
      ) {
        // This is a continuation chunk - append arguments
        const newArgs = toolInvocation.function.arguments || '';
        if (newArgs) {
          updatedActiveToolCall.argumentsBuffer += newArgs;
        }
      }
    }

    return updatedActiveToolCall;
  }

  /**
   * Create a text content candidate
   */
  private createTextCandidate(content: string): Candidate {
    return {
      content: {
        parts: [{ text: content }],
        role: 'model',
      },
      index: 0,
      safetyRatings: [],
    };
  }

  /**
   * Handle usage-only chunks (final chunks)
   */
  private handleUsageOnlyChunk(
    data: ChatGenerations,
    generations: NonNullable<
      ChatGenerations['generation_details']
    >['generations'],
  ): Candidate | null {
    const usage = data.generation_details?.parameters?.usage;
    const hasAnyMeaningfulContent = generations.some(
      (g) =>
        (g.content && g.content.trim()) ||
        (g.tool_invocations && g.tool_invocations.length > 0),
    );
    const isUsageOnlyChunk = usage && !hasAnyMeaningfulContent;

    if (isUsageOnlyChunk) {
      return {
        content: {
          parts: [],
          role: 'model',
        },
        index: 0,
        safetyRatings: [],
        finishReason: 'STOP' as FinishReason,
      };
    }

    return null;
  }

  /**
   * Handle case where stream ends with an incomplete tool call
   */
  private handleIncompleteStreamingToolCall(
    useStreamingToolCalls: boolean,
    activeToolCall: StreamingToolCall | null,
  ): void {
    if (useStreamingToolCalls && activeToolCall) {
      console.warn(
        `[DEBUG] Stream ended with incomplete tool call:`,
        activeToolCall,
      );
      // Could emit an error response here if needed
    }
  }
}
