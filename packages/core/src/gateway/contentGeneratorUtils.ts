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
  type Content,
  type Part,
  type Candidate,
  type ContentListUnion,
  type ContentUnion,
  type ToolListUnion,
  type FinishReason,
} from '@google/genai';
import { type ChatGenerations, type ChatCompletionTool } from './client.js';

/**
 * Type definition for streaming tool call state
 */
export type StreamingToolCall = {
  id: string;
  name: string;
  argumentsBuffer: string;
};

/**
 * Type guard to check if content is a string.
 *
 * @param content - The content to check
 * @returns True if content is a string, false otherwise
 */
export const isString = (content: ContentUnion): content is string =>
  typeof content === 'string';

/**
 * Type guard to check if content is a Part object.
 *
 * @param content - The content to check
 * @returns True if content is a Part with text, inlineData, or fileData properties
 */
export const isPart = (content: ContentUnion): content is Part =>
  typeof content === 'object' &&
  content !== null &&
  ('text' in content || 'inlineData' in content || 'fileData' in content);

/**
 * Type guard to check if content is a Content object.
 *
 * @param content - The content to check
 * @returns True if content is a Content object with parts property
 */
export const isContent = (content: ContentUnion): content is Content =>
  typeof content === 'object' && content !== null && 'parts' in content;

/**
 * Maps Gateway parameter names to the expected tool parameter names.
 * Handles tool-specific parameter name transformations for compatibility.
 *
 * @param toolName - The name of the tool being invoked
 * @param args - The original arguments object from the Gateway
 * @returns A new arguments object with mapped parameter names
 */
export const mapToolParameters = (
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
    default:
      break;
  }

  return mappedArgs;
};

/**
 * Converts a Gateway generation object to a Gemini Candidate format.
 * Handles both streaming and non-streaming tool calls, text content, and error cases.
 *
 * @param generation - The Gateway generation object containing tool invocations or text content
 * @param completedToolCalls - Optional map of completed tool calls for streaming scenarios
 * @returns A Gemini Candidate object with properly formatted parts and metadata
 */
export const convertGenerationToCandidate = (
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

  const candidate = {
    content: {
      parts,
      role: 'model',
    },
    index: 0,
    safetyRatings: [],
  };

  return candidate;
};

/**
 * Converts ContentListUnion to Content array format.
 * Handles both single content items and arrays of content items.
 *
 * @param contents - The content list to convert, can be single item or array
 * @returns Array of Content objects in standardized format
 */
export const toContentsArray = (contents: ContentListUnion): Content[] => {
  if (Array.isArray(contents)) {
    return contents.map(toContent);
  }
  return [toContent(contents)];
};

/**
 * Converts ContentUnion to standardized Content format.
 * Handles strings, Part objects, arrays of parts, and existing Content objects.
 *
 * @param content - The content to convert to Content format
 * @returns A Content object with role and parts properties
 */
export const toContent = (content: ContentUnion): Content => {
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
};

/**
 * Converts various content formats to plain text string.
 * Recursively processes Content objects, Part objects, arrays, and primitives.
 *
 * @param content - The content to convert to text
 * @returns A string representation of the content
 */
export const convertContentToText = (content: ContentUnion): string => {
  if (isString(content)) {
    return content;
  }

  if (isPart(content)) {
    return content.text || '';
  }

  if (isContent(content)) {
    return (
      content.parts?.map((part) => convertContentToText(part)).join(' ') || ''
    );
  }

  if (Array.isArray(content)) {
    return content.map((c) => convertContentToText(c)).join('\n');
  }

  return JSON.stringify(content);
};

/**
 * Converts Gemini tool definitions to Gateway ChatCompletionTool format.
 * Processes function declarations and normalizes parameter schemas for Gateway compatibility.
 *
 * @param tools - The Gemini tool list to convert
 * @returns Array of ChatCompletionTool objects formatted for Gateway API
 */
export const convertGeminiToolsToGateway = (
  tools: ToolListUnion,
): ChatCompletionTool[] => {
  const gatewayTools: ChatCompletionTool[] = [];

  for (const tool of tools) {
    if (
      'functionDeclarations' in tool &&
      Array.isArray(tool.functionDeclarations)
    ) {
      for (const funcDecl of tool.functionDeclarations) {
        // Normalize the parameter schema to fix type case issues and other inconsistencies
        const normalizedSchema = normalizeParameterSchema(
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
    }
  }

  return gatewayTools;
};

/**
 * Normalizes parameter schema to ensure Gateway API compatibility.
 * Fixes common issues like uppercase type specifications and other schema inconsistencies.
 * Recursively processes nested objects and arrays to normalize all type fields.
 *
 * @param schema - The parameter schema object to normalize
 * @returns A normalized schema object with lowercase type specifications
 */
export const normalizeParameterSchema = (
  schema: Record<string, unknown>,
): Record<string, unknown> => {
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
};

/**
 * Creates a text content candidate for streaming responses.
 * Provides a standardized Candidate object containing only text content.
 *
 * @param content - The text content to wrap in a candidate
 * @returns A Candidate object with text content and default metadata
 */
export const createTextCandidate = (content: string): Candidate => ({
  content: {
    parts: [{ text: content }],
    role: 'model',
  },
  index: 0,
  safetyRatings: [],
});

/**
 * Handles completion of streaming tool calls.
 * Detects when a streaming tool call has finished and creates the final candidate.
 *
 * @param activeToolCall - The currently active streaming tool call state
 * @param generations - The current generation chunks to check for completion
 * @returns A completed Candidate with the tool call, or null if not yet complete
 */
export const handleCompletedStreamingToolCall = (
  activeToolCall: StreamingToolCall | null,
  generations: NonNullable<
    ChatGenerations['generation_details']
  >['generations'],
): Candidate | null => {
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
};

/**
 * Handles streaming tool invocations and updates active tool call state.
 * Manages the accumulation of tool call arguments across multiple streaming chunks.
 *
 * @param toolInvocations - The tool invocations from the current generation chunk
 * @param activeToolCall - The current active tool call state to update
 * @returns Updated StreamingToolCall state or null if no active call
 */
export const handleStreamingToolInvocations = (
  toolInvocations: NonNullable<
    ChatGenerations['generation_details']
  >['generations'][number]['tool_invocations'],
  activeToolCall: StreamingToolCall | null,
): StreamingToolCall | null => {
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
};

/**
 * Handles usage-only chunks that appear at the end of streaming responses.
 * Detects final chunks that contain only usage metadata without meaningful content.
 *
 * @param data - The ChatGenerations data containing usage information
 * @param generations - The generation chunks to check for meaningful content
 * @returns A final Candidate with STOP finish reason, or null if not a usage-only chunk
 */
export const handleUsageOnlyChunk = (
  data: ChatGenerations,
  generations: NonNullable<
    ChatGenerations['generation_details']
  >['generations'],
): Candidate | null => {
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
};

/**
 * Handles cases where streaming ends with an incomplete tool call.
 * Logs warnings for debugging when tool calls are not properly completed.
 *
 * @param useStreamingToolCalls - Whether streaming tool calls are enabled
 * @param activeToolCall - The potentially incomplete active tool call
 */
export const handleIncompleteStreamingToolCall = (
  useStreamingToolCalls: boolean,
  activeToolCall: StreamingToolCall | null,
): void => {
  if (useStreamingToolCalls && activeToolCall) {
    console.warn(
      `[DEBUG] Stream ended with incomplete tool call:`,
      activeToolCall,
    );
    // Could emit an error response here if needed
  }
};

/**
 * Processes generation chunks and returns a single merged candidate with updated tool call state.
 * Handles both streaming and non-streaming tool calls, merges multiple candidates when needed.
 *
 * @param generations - The generation chunks to process
 * @param useStreamingToolCalls - Whether to use streaming tool call handling
 * @param activeToolCall - The current active tool call state
 * @returns Object containing the merged candidate and updated tool call state
 */
export const processGenerationChunks = (
  generations: NonNullable<
    ChatGenerations['generation_details']
  >['generations'],
  useStreamingToolCalls: boolean,
  activeToolCall: StreamingToolCall | null,
): {
  candidate: Candidate | null;
  updatedActiveToolCall: StreamingToolCall | null;
} => {
  const candidates: Candidate[] = [];
  let updatedActiveToolCall = activeToolCall;

  for (const generation of generations) {
    if (
      generation?.tool_invocations &&
      generation.tool_invocations.length > 0
    ) {
      if (useStreamingToolCalls) {
        updatedActiveToolCall = handleStreamingToolInvocations(
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
      candidates.push(createTextCandidate(generation.content));
    }
  }

  // Merge multiple candidates into a single candidate for streaming consistency
  if (candidates.length === 0) {
    return { candidate: null, updatedActiveToolCall };
  } else if (candidates.length === 1) {
    return { candidate: candidates[0], updatedActiveToolCall };
  } else {
    // Merge multiple candidates into one
    const mergedParts = candidates.flatMap((c) => c.content?.parts || []);
    const mergedCandidate: Candidate = {
      content: {
        parts: mergedParts,
        role: 'model',
      },
      index: 0,
      safetyRatings: [],
    };
    return { candidate: mergedCandidate, updatedActiveToolCall };
  }
};
