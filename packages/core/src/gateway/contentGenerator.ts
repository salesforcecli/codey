/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CountTokensResponse,
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
} from '@google/genai';
import {
  GatewayClient,
  type ChatGenerations,
  type GatewayResponse,
  type ChatCompletionTool,
  type ChatGenerationRequest,
} from './client.js';
import { type ContentGenerator } from '../core/contentGenerator.js';
import { Claude4Sonnet } from './models.js';
import { FunctionCallAccumulator } from './functionCallAccumulator.js';

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

const convertGenerationToCandidate = (
  generation: NonNullable<
    ChatGenerations['generation_details']
  >['generations'][number],
): Candidate => {
  const parts: Part[] = [];

  // Add tool calls if present
  if (generation.tool_invocations && generation.tool_invocations.length > 0) {
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
            id: toolInvocation.id, // Preserve tool call ID
          },
        });
      } catch (error) {
        console.error(
          `Failed to parse tool arguments for ${toolInvocation.function.name}:`,
          error,
        );
        // Add error handling - maybe add as text part explaining the error
        parts.push({
          text: `Error: Failed to parse tool call ${toolInvocation.function.name}`,
        });
      }
    }
  } else if (generation.content) {
    // Use the accumulator to parse function calls from content
    const accumulator = new FunctionCallAccumulator();
    const feedResult = accumulator.feed(generation.content);
    const flushResult = accumulator.flush();

    // Combine text from both feed and flush results
    const combinedText = (feedResult.text + flushResult.text).trim();

    // Add any parsed function calls from feed
    for (const call of feedResult.calls) {
      const mappedArgs = mapToolParameters(call.name, call.args || {});
      parts.push({
        functionCall: {
          name: call.name,
          args: mappedArgs,
          id: call.id,
        },
      });
    }

    // Add any parsed function calls from flush
    for (const call of flushResult.calls) {
      const mappedArgs = mapToolParameters(call.name, call.args || {});
      parts.push({
        functionCall: {
          name: call.name,
          args: mappedArgs,
          id: call.id,
        },
      });
    }

    // Add combined text content if there's any
    if (combinedText) {
      parts.push({ text: combinedText });
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
  private usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  } = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };
  // Default to Claude4Sonnet model for now - this could be made configurable
  model = Claude4Sonnet;

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
    const candidates = generations?.map(convertGenerationToCandidate) || [];
    const usage = chatResponse.data.generation_details?.parameters?.usage;
    if (usage) {
      this.usage = {
        inputTokens: usage.inputTokens ?? this.usage.inputTokens,
        outputTokens: usage.outputTokens ?? this.usage.outputTokens,
        totalTokens: usage.totalTokens ?? this.usage.totalTokens,
      };
    }

    const response = new GenerateContentResponse();
    response.candidates = candidates;
    response.usageMetadata = {
      promptTokenCount: usage?.inputTokens ?? this.usage.inputTokens,
      candidatesTokenCount: usage?.outputTokens ?? this.usage.outputTokens,
      totalTokenCount: usage?.totalTokens ?? this.usage.totalTokens,
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
    const accumulator = new FunctionCallAccumulator();
    let lastGenerationId = '';

    for await (const data of streamGenerator) {
      const generations = data.generation_details?.generations;
      const usage = data.generation_details?.parameters?.usage;

      if (usage) {
        this.usage = {
          inputTokens: usage.inputTokens ?? this.usage.inputTokens,
          outputTokens: usage.outputTokens ?? this.usage.outputTokens,
          totalTokens: usage.totalTokens ?? this.usage.totalTokens,
        };
      }

      const response = new GenerateContentResponse();
      response.candidates = [];
      response.usageMetadata = {
        promptTokenCount: this.usage.inputTokens,
        candidatesTokenCount: this.usage.outputTokens,
        totalTokenCount: this.usage.totalTokens,
      };
      response.modelVersion = this.model.model;

      for (const generation of generations || []) {
        // If this generation has tool invocations, handle them directly
        if (
          generation?.tool_invocations &&
          generation.tool_invocations.length > 0
        ) {
          const candidate = convertGenerationToCandidate(generation);
          response.candidates.push(candidate);
        }
        // Otherwise, use accumulator to process content
        else if (generation?.content) {
          // Reset accumulator if we're starting a new generation sequence
          if (data.id && data.id !== lastGenerationId) {
            accumulator.reset();
            lastGenerationId = data.id;
          }

          const result = accumulator.feed(generation.content);

          // Add any complete function calls found
          for (const call of result.calls) {
            const mappedArgs = mapToolParameters(call.name, call.args || {});
            const functionCallPart: Part = {
              functionCall: {
                name: call.name,
                args: mappedArgs,
                id: call.id,
              },
            };

            const candidate: Candidate = {
              content: {
                parts: [functionCallPart],
                role: 'model',
              },
              index: 0,
              safetyRatings: [],
            };

            response.candidates.push(candidate);
          }

          // Add any text content that's ready to be displayed
          if (result.text.trim()) {
            const textPart: Part = { text: result.text };
            const candidate: Candidate = {
              content: {
                parts: [textPart],
                role: 'model',
              },
              index: 0,
              safetyRatings: [],
            };

            response.candidates.push(candidate);
          }
        }
      }

      yield response;
    }

    // Handle any remaining content at the end
    const flushResult = accumulator.flush();

    if (flushResult.calls.length > 0 || flushResult.text.trim()) {
      const finalResponse = new GenerateContentResponse();
      finalResponse.candidates = [];
      finalResponse.usageMetadata = {
        promptTokenCount: this.usage.inputTokens,
        candidatesTokenCount: this.usage.outputTokens,
        totalTokenCount: this.usage.totalTokens,
      };
      finalResponse.modelVersion = this.model.model;

      // Add any final function calls
      for (const call of flushResult.calls) {
        const mappedArgs = mapToolParameters(call.name, call.args || {});
        const functionCallPart: Part = {
          functionCall: {
            name: call.name,
            args: mappedArgs,
            id: call.id,
          },
        };

        const candidate: Candidate = {
          content: {
            parts: [functionCallPart],
            role: 'model',
          },
          index: 0,
          safetyRatings: [],
        };

        finalResponse.candidates.push(candidate);
      }

      // Add any final text content
      if (flushResult.text.trim()) {
        const textPart: Part = { text: flushResult.text };
        const candidate: Candidate = {
          content: {
            parts: [textPart],
            role: 'model',
          },
          index: 0,
          safetyRatings: [],
        };

        finalResponse.candidates.push(candidate);
      }

      yield finalResponse;
    }
  }
}
