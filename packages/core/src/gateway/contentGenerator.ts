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
  ToolListUnion,
} from '@google/genai';
import {
  GatewayClient,
  ChatGenerations,
  GatewayResponse,
  ChatCompletionTool,
  ChatGenerationRequest,
} from './client.js';
import { ContentGenerator } from '../core/contentGenerator.js';
import { Claude4Sonnet } from './models.js';

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
 * Extracts complete function call JSON objects from content using proper JSON parsing.
 * This is more robust than regex for handling complex nested objects and escaped content.
 */
const extractFunctionCallsFromContent = (content: string): string[] => {
  const functionCalls: string[] = [];
  let searchIndex = 0;

  while (true) {
    // Find the next occurrence of a function call start
    const startIndex = content.indexOf('{"functionCall":', searchIndex);
    if (startIndex === -1) break;

    // Try to find the complete JSON object by counting braces
    let braceCount = 0;
    let inString = false;
    let escaped = false;
    let endIndex = startIndex;

    for (let i = startIndex; i < content.length; i++) {
      const char = content[i];

      if (!inString) {
        if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            endIndex = i + 1;
            break;
          }
        } else if (char === '"') {
          inString = true;
        }
      } else {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
      }
    }

    // If we found a complete JSON object, extract it
    if (braceCount === 0 && endIndex > startIndex) {
      const jsonStr = content.substring(startIndex, endIndex);
      try {
        // Validate it's proper JSON and contains a functionCall
        const parsed = JSON.parse(jsonStr);
        if (parsed.functionCall) {
          functionCalls.push(jsonStr);
        }
      } catch (_error) {
        // If it's not valid JSON, skip it
        console.warn(
          '[Gateway] Found function call pattern but invalid JSON:',
          jsonStr.substring(0, 100) + '...',
        );
      }
      searchIndex = endIndex;
    } else {
      // Move past this occurrence and continue searching
      searchIndex = startIndex + 1;
    }
  }

  return functionCalls;
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
    // Check if the content contains function calls in JSON format
    // Use a more robust approach to extract complete JSON objects
    const content = generation.content || '';

    const functionCallMatches = extractFunctionCallsFromContent(content);

    if (functionCallMatches && functionCallMatches.length > 0) {
      // Track successfully parsed function calls to remove from content
      const successfullyParsedCalls: string[] = [];

      // Parse each function call from the content
      for (const functionCallJson of functionCallMatches) {
        try {
          const parsed = JSON.parse(functionCallJson);
          if (parsed.functionCall && parsed.functionCall.name) {
            parts.push({
              functionCall: {
                name: parsed.functionCall.name,
                args: parsed.functionCall.args || {},
                id: parsed.functionCall.id,
              },
            });
            // Track this as successfully parsed so we can remove it from content
            successfullyParsedCalls.push(functionCallJson);
          }
        } catch (error) {
          console.error(
            '[Gateway] Failed to parse function call from content:',
            error,
          );
          // Fall back to treating as text if parsing fails
          parts.push({ text: functionCallJson });
        }
      }

      // Remove successfully parsed function calls from content and check for remaining text
      let remainingContent = generation.content!;
      for (const parsedCall of successfullyParsedCalls) {
        remainingContent = remainingContent.replace(parsedCall, '');
      }

      // Only add remaining text content if there's meaningful text left after removing function calls
      const trimmedRemainingContent = remainingContent.trim();
      if (trimmedRemainingContent) {
        parts.push({ text: trimmedRemainingContent });
      }
    } else {
      // Only add text content if there are no tool invocations and no function calls in content
      // This prevents duplicate function call representation (text + function call parts)
      parts.push({ text: generation.content! });
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
   * Determines if content looks like regular text vs a function call fragment.
   * This is used in streaming to avoid displaying partial function call JSON.
   */
  private isRegularTextContent(
    content: string,
    accumulatedContent: string,
  ): boolean {
    // If accumulated content suggests we're building a function call, be extra cautious
    const suspiciousAccumulated =
      accumulatedContent.includes('{"') ||
      accumulatedContent.includes('functionCall') ||
      accumulatedContent.includes('"args"') ||
      accumulatedContent.includes('"name"');

    // Function call fragments to detect
    const functionCallIndicators = [
      '{"',
      'functionCall',
      '"args":',
      '"name":',
      'file_path',
      'content":',
      'tooluse_',
      ',"id":"',
      '"function":',
      'write_file',
      'read_file',
      'edit_file',
      'shell_command',
      '},"id"',
    ];

    // Check if current content contains function call indicators
    const hasFunctionCallIndicators = functionCallIndicators.some((indicator) =>
      content.includes(indicator),
    );

    // If we're in the middle of building a function call, don't show any content
    if (suspiciousAccumulated && hasFunctionCallIndicators) {
      return false;
    }

    // If current content has function call patterns, don't show it
    if (hasFunctionCallIndicators) {
      return false;
    }

    // Additional check: if content looks like JSON property patterns
    const jsonPropertyPatterns = [
      /^[^"]*"[^"]+"\s*:\s*/, // matches things like `path": ` or `"content": `
      /^[^}]*},"/, // matches ending of one object and start of another
      /^[^{]*{"[^"]*"\s*:\s*/, // matches start of JSON object
    ];

    const looksLikeJsonFragment = jsonPropertyPatterns.some((pattern) =>
      pattern.test(content.trim()),
    );

    if (looksLikeJsonFragment) {
      return false;
    }

    // If we get here, it's probably safe to display
    return true;
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
    let accumulatedContent = '';
    let lastGenerationId = '';
    let inFunctionCall = false; // Track if we're currently accumulating a function call

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
        // Otherwise, accumulate content to detect complete function calls
        else if (generation?.content) {
          // Reset accumulation if we're starting a new generation sequence
          if (data.id && data.id !== lastGenerationId) {
            accumulatedContent = '';
            lastGenerationId = data.id;
            inFunctionCall = false;
          }

          // Check if this chunk starts a function call
          if (
            !inFunctionCall &&
            generation.content.includes('{"functionCall":')
          ) {
            inFunctionCall = true;
            accumulatedContent = generation.content;
            // Don't yield anything when we start a function call
            continue;
          }
          // If we're already in a function call, keep accumulating
          else if (inFunctionCall) {
            accumulatedContent += generation.content;

            // Check if we have complete function calls in the accumulated content
            const functionCallMatches =
              extractFunctionCallsFromContent(accumulatedContent);

            if (functionCallMatches && functionCallMatches.length > 0) {
              // We found complete function calls, process them
              const syntheticGeneration = {
                content: functionCallMatches.join(''),
                role: generation.role,
                tool_invocations: undefined,
              };

              const candidate =
                convertGenerationToCandidate(syntheticGeneration);
              response.candidates.push(candidate);

              // Remove processed function calls and reset state
              let remainingContent = accumulatedContent;
              for (const match of functionCallMatches) {
                remainingContent = remainingContent.replace(match, '');
              }

              // If there's remaining content, check if it contains more function calls
              if (remainingContent.trim()) {
                if (remainingContent.includes('{"functionCall":')) {
                  // More function calls coming, keep accumulating
                  accumulatedContent = remainingContent;
                } else {
                  // No more function calls, reset state
                  accumulatedContent = '';
                  inFunctionCall = false;

                  // If remaining content is legitimate text, show it
                  if (this.isRegularTextContent(remainingContent, '')) {
                    const textGeneration = {
                      content: remainingContent,
                      role: generation.role,
                      tool_invocations: undefined,
                    };
                    const textCandidate =
                      convertGenerationToCandidate(textGeneration);
                    response.candidates.push(textCandidate);
                  }
                }
              } else {
                // No remaining content, reset state
                accumulatedContent = '';
                inFunctionCall = false;
              }
            }
            // Still accumulating function call, don't yield anything
          }
          // Not in a function call and doesn't start one - treat as regular content
          else if (this.isRegularTextContent(generation.content, '')) {
            const candidate = convertGenerationToCandidate(generation);
            response.candidates.push(candidate);
          }
          // Content looks suspicious but we're not in a function call - start accumulating
          else {
            inFunctionCall = true;
            accumulatedContent = generation.content;
          }
        }
      }

      yield response;
    }

    // Handle any remaining accumulated content at the end
    if (accumulatedContent.trim()) {
      if (inFunctionCall) {
        // Try to extract any complete function calls from remaining content
        const functionCallMatches =
          extractFunctionCallsFromContent(accumulatedContent);
        if (functionCallMatches && functionCallMatches.length > 0) {
          const syntheticGeneration = {
            content: functionCallMatches.join(''),
            role: 'assistant' as const,
            tool_invocations: undefined,
          };

          const candidate = convertGenerationToCandidate(syntheticGeneration);
          const finalResponse = new GenerateContentResponse();
          finalResponse.candidates = [candidate];
          finalResponse.usageMetadata = {
            promptTokenCount: this.usage.inputTokens,
            candidatesTokenCount: this.usage.outputTokens,
            totalTokenCount: this.usage.totalTokens,
          };
          finalResponse.modelVersion = this.model.model;
          yield finalResponse;
        } else {
          // Incomplete function call at end - log warning but don't display
          console.warn(
            '[Gateway] Stream ended with incomplete function call:',
            accumulatedContent.substring(0, 100) + '...',
          );
        }
      } else {
        // Regular content at end
        const syntheticGeneration = {
          content: accumulatedContent,
          role: 'assistant' as const,
          tool_invocations: undefined,
        };

        const candidate = convertGenerationToCandidate(syntheticGeneration);
        const finalResponse = new GenerateContentResponse();
        finalResponse.candidates = [candidate];
        finalResponse.usageMetadata = {
          promptTokenCount: this.usage.inputTokens,
          candidatesTokenCount: this.usage.outputTokens,
          totalTokenCount: this.usage.totalTokens,
        };
        finalResponse.modelVersion = this.model.model;
        yield finalResponse;
      }
    }
  }
}
