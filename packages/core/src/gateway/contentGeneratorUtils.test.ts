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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  Content,
  Part,
  ContentListUnion,
  ContentUnion,
  ToolListUnion,
  GenerateContentParameters,
} from '@google/genai';
import type { ChatGenerations } from './types.js';
import type { GatewayModel } from './models.js';
import {
  mapToolParameters,
  convertGenerationToCandidate,
  toContentsArray,
  toContent,
  convertContentToText,
  convertGeminiToolsToGateway,
  normalizeParameterSchema,
  createTextCandidate,
  handleCompletedStreamingToolCall,
  handleStreamingToolInvocations,
  handleTerminalChunk,
  handleIncompleteStreamingToolCall,
  processGenerationChunks,
  maybeConstructResponseFormat,
  maybeInsertJsonInstructions,
  type StreamingToolCall,
} from './contentGeneratorUtils.js';

// Mock console methods to capture error and warning logs
const mockConsoleError = vi.fn();
const mockConsoleWarn = vi.fn();

// Override global console methods
vi.stubGlobal('console', {
  error: mockConsoleError,
  warn: mockConsoleWarn,
  log: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
});

describe('contentGeneratorUtils', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('mapToolParameters', () => {
    it('should map file_path to absolute_path for read_file tool', () => {
      const args = { file_path: '/path/to/file.txt', other_param: 'value' };
      const result = mapToolParameters('read_file', args);

      expect(result).toEqual({
        absolute_path: '/path/to/file.txt',
        other_param: 'value',
      });
      expect(result).not.toHaveProperty('file_path');
    });

    it('should return unchanged args for unknown tools', () => {
      const args = { file_path: '/path/to/file.txt', other_param: 'value' };
      const result = mapToolParameters('unknown_tool', args);

      expect(result).toEqual(args);
      expect(result).not.toBe(args); // Should be a new object
    });

    it('should handle empty args object', () => {
      const args = {};
      const result = mapToolParameters('read_file', args);

      expect(result).toEqual({});
    });

    it('should handle args without file_path for read_file tool', () => {
      const args = { other_param: 'value' };
      const result = mapToolParameters('read_file', args);

      expect(result).toEqual({ other_param: 'value' });
    });
  });

  describe('convertGenerationToCandidate', () => {
    it('should convert generation with text content', () => {
      const generation = {
        content: 'Hello, world!',
        role: 'model',
      };

      const result = convertGenerationToCandidate(generation);

      expect(result).toEqual({
        content: {
          parts: [{ text: 'Hello, world!' }],
          role: 'model',
        },
        index: 0,
        safetyRatings: [],
      });
    });

    it('should convert generation with tool invocations', () => {
      const generation = {
        content: '',
        role: 'model',
        tool_invocations: [
          {
            id: 'tool_1',
            function: {
              name: 'test_tool',
              arguments: '{"param": "value"}',
            },
          },
        ],
      };

      const result = convertGenerationToCandidate(generation);

      expect(result.content?.parts).toHaveLength(1);
      expect(result.content?.parts?.[0]).toEqual({
        functionCall: {
          name: 'test_tool',
          args: { param: 'value' },
          id: 'tool_1',
        },
      });
    });

    it('should handle tool invocations with parameter mapping', () => {
      const generation = {
        content: '',
        role: 'model',
        tool_invocations: [
          {
            id: 'tool_1',
            function: {
              name: 'read_file',
              arguments: '{"file_path": "/test/file.txt"}',
            },
          },
        ],
      };

      const result = convertGenerationToCandidate(generation);

      expect(result.content?.parts?.[0]).toEqual({
        functionCall: {
          name: 'read_file',
          args: { absolute_path: '/test/file.txt' },
          id: 'tool_1',
        },
      });
    });

    it('should handle invalid JSON in tool arguments', () => {
      const generation = {
        content: '',
        role: 'model',
        tool_invocations: [
          {
            id: 'tool_1',
            function: {
              name: 'test_tool',
              arguments: 'invalid json',
            },
          },
        ],
      };

      const result = convertGenerationToCandidate(generation);

      expect(result.content?.parts).toHaveLength(1);
      expect(result.content?.parts?.[0]).toEqual({
        text: 'Error: Failed to parse tool call test_tool',
      });
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Failed to parse tool arguments for test_tool:',
        expect.any(Error),
      );
    });

    it('should convert completed tool calls from buffer', () => {
      const generation = {
        content: '',
        role: 'model',
      };

      const completedToolCalls = new Map([
        [
          'tool_1',
          {
            id: 'tool_1',
            name: 'test_tool',
            arguments: '{"param": "value"}',
          },
        ],
      ]);

      const result = convertGenerationToCandidate(
        generation,
        completedToolCalls,
      );

      expect(result.content?.parts).toHaveLength(1);
      expect(result.content?.parts?.[0]).toEqual({
        functionCall: {
          name: 'test_tool',
          args: { param: 'value' },
          id: 'tool_1',
        },
      });
    });

    it('should handle invalid JSON in completed tool calls', () => {
      const generation = {
        content: '',
        role: 'model',
      };

      const completedToolCalls = new Map([
        [
          'tool_1',
          {
            id: 'tool_1',
            name: 'test_tool',
            arguments: 'invalid json',
          },
        ],
      ]);

      const result = convertGenerationToCandidate(
        generation,
        completedToolCalls,
      );

      expect(result.content?.parts).toHaveLength(1);
      expect(result.content?.parts?.[0]).toEqual({
        text: 'Error: Failed to parse tool call test_tool',
      });
    });
  });

  describe('toContentsArray', () => {
    it('should convert single content to array', () => {
      const content: ContentUnion = 'Hello, world!';
      const result = toContentsArray(content);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        role: 'user',
        parts: [{ text: 'Hello, world!' }],
      });
    });

    it('should convert array of contents', () => {
      const contents: ContentListUnion = ['Hello', { text: 'World' }];
      const result = toContentsArray(contents);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        role: 'user',
        parts: [{ text: 'Hello' }],
      });
      expect(result[1]).toEqual({
        role: 'user',
        parts: [{ text: 'World' }],
      });
    });
  });

  describe('toContent', () => {
    it('should convert string to Content', () => {
      const result = toContent('Hello, world!');

      expect(result).toEqual({
        role: 'user',
        parts: [{ text: 'Hello, world!' }],
      });
    });

    it('should convert Part to Content', () => {
      const part: Part = { text: 'Hello, world!' };
      const result = toContent(part);

      expect(result).toEqual({
        role: 'user',
        parts: [part],
      });
    });

    it('should convert array of parts to Content', () => {
      const parts = [{ text: 'Hello' }, 'World'];
      const result = toContent(parts);

      expect(result).toEqual({
        role: 'user',
        parts: [{ text: 'Hello' }, { text: 'World' }],
      });
    });

    it('should return Content object as-is', () => {
      const content: Content = {
        role: 'assistant',
        parts: [{ text: 'Hello' }],
      };
      const result = toContent(content);

      expect(result).toEqual(content);
    });
  });

  describe('convertContentToText', () => {
    it('should convert string content', () => {
      const result = convertContentToText('Hello, world!');
      expect(result).toBe('Hello, world!');
    });

    it('should convert Part with text', () => {
      const part: Part = { text: 'Hello, world!' };
      const result = convertContentToText(part);
      expect(result).toBe('Hello, world!');
    });

    it('should convert Part without text', () => {
      const part: Part = {
        inlineData: { mimeType: 'image/png', data: 'base64data' },
      };
      const result = convertContentToText(part);
      expect(result).toBe('');
    });

    it('should convert Content object', () => {
      const content: Content = {
        role: 'user',
        parts: [{ text: 'Hello' }, { text: 'World' }],
      };
      const result = convertContentToText(content);
      expect(result).toBe('Hello World');
    });

    it('should convert array of contents', () => {
      const contents = ['Hello', { text: 'World' }];
      const result = convertContentToText(contents);
      expect(result).toBe('Hello\nWorld');
    });

    it('should stringify unknown content types', () => {
      const unknownContent = { unknown: 'property' };
      const result = convertContentToText(unknownContent as ContentUnion);
      expect(result).toBe('{"unknown":"property"}');
    });
  });

  describe('convertGeminiToolsToGateway', () => {
    it('should convert Gemini tools to Gateway format', () => {
      const geminiTools: ToolListUnion = [
        {
          functionDeclarations: [
            {
              name: 'test_function',
              description: 'A test function',
              parametersJsonSchema: {
                type: 'OBJECT',
                properties: {
                  param1: { type: 'STRING' },
                },
                required: ['param1'],
              },
            },
          ],
        },
      ];

      const result = convertGeminiToolsToGateway(geminiTools);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'function',
        function: {
          name: 'test_function',
          description: 'A test function',
          parameters: {
            type: 'object',
            properties: {
              param1: { type: 'string' },
            },
            required: ['param1'],
          },
        },
      });
    });

    it('should handle tools without function declarations', () => {
      const geminiTools: ToolListUnion = [
        {
          // No functionDeclarations property
        },
      ];

      const result = convertGeminiToolsToGateway(geminiTools);
      expect(result).toEqual([]);
    });

    it('should handle empty function declarations', () => {
      const geminiTools: ToolListUnion = [
        {
          functionDeclarations: [],
        },
      ];

      const result = convertGeminiToolsToGateway(geminiTools);
      expect(result).toEqual([]);
    });

    it('should handle missing name or description', () => {
      const geminiTools: ToolListUnion = [
        {
          functionDeclarations: [
            {
              // Missing name and description
              parametersJsonSchema: { type: 'OBJECT' },
            },
          ],
        },
      ];

      const result = convertGeminiToolsToGateway(geminiTools);

      expect(result).toHaveLength(1);
      expect(result[0].function?.name).toBe('');
      expect(result[0].function?.description).toBe('');
    });
  });

  describe('normalizeParameterSchema', () => {
    it('should normalize type properties to lowercase', () => {
      const schema = {
        type: 'OBJECT',
        properties: {
          prop1: { type: 'STRING' },
          prop2: { type: 'NUMBER' },
        },
      };

      const result = normalizeParameterSchema(schema);

      expect(result).toEqual({
        type: 'object',
        properties: {
          prop1: { type: 'string' },
          prop2: { type: 'number' },
        },
      });
    });

    it('should handle nested objects recursively', () => {
      const schema = {
        type: 'OBJECT',
        properties: {
          nested: {
            type: 'OBJECT',
            properties: {
              deep: { type: 'STRING' },
            },
          },
        },
      };

      const result = normalizeParameterSchema(schema);

      expect(result).toEqual({
        type: 'object',
        properties: {
          nested: {
            type: 'object',
            properties: {
              deep: { type: 'string' },
            },
          },
        },
      });
    });

    it('should handle arrays', () => {
      const schema = {
        type: 'OBJECT',
        properties: {
          items: {
            type: 'ARRAY',
            items: [{ type: 'STRING' }, { type: 'NUMBER' }],
          },
        },
      };

      const result = normalizeParameterSchema(schema);

      expect(result).toEqual({
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: [{ type: 'string' }, { type: 'number' }],
          },
        },
      });
    });

    it('should handle null or undefined schema', () => {
      expect(
        normalizeParameterSchema(null as unknown as Record<string, unknown>),
      ).toBe(null);
      expect(
        normalizeParameterSchema(
          undefined as unknown as Record<string, unknown>,
        ),
      ).toBe(undefined);
    });

    it('should preserve non-type properties', () => {
      const schema = {
        type: 'OBJECT',
        description: 'A test schema',
        required: ['prop1'],
        properties: {
          prop1: { type: 'STRING', description: 'A string property' },
        },
      };

      const result = normalizeParameterSchema(schema);

      expect(result).toEqual({
        type: 'object',
        description: 'A test schema',
        required: ['prop1'],
        properties: {
          prop1: { type: 'string', description: 'A string property' },
        },
      });
    });
  });

  describe('createTextCandidate', () => {
    it('should create a text candidate with proper structure', () => {
      const result = createTextCandidate('Hello, world!');

      expect(result).toEqual({
        content: {
          parts: [{ text: 'Hello, world!' }],
          role: 'model',
        },
        index: 0,
        safetyRatings: [],
      });
    });

    it('should handle empty string', () => {
      const result = createTextCandidate('');

      expect(result.content?.parts?.[0]?.text).toBe('');
    });
  });

  describe('handleCompletedStreamingToolCall', () => {
    it('should return null when no active tool call', () => {
      const result = handleCompletedStreamingToolCall(null, []);
      expect(result).toBe(null);
    });

    it('should return null when generations have tool invocations', () => {
      const activeToolCall: StreamingToolCall = {
        id: 'tool_1',
        name: 'test_tool',
        argumentsBuffer: '{"param": "value"}',
      };

      const generations = [
        {
          content: '',
          role: 'model',
          tool_invocations: [
            {
              id: 'tool_1',
              function: { name: 'test_tool', arguments: '' },
            },
          ],
        },
      ];

      const result = handleCompletedStreamingToolCall(
        activeToolCall,
        generations,
      );
      expect(result).toBe(null);
    });

    it('should return completed candidate when no tool invocations', () => {
      const activeToolCall: StreamingToolCall = {
        id: 'tool_1',
        name: 'test_tool',
        argumentsBuffer: '{"param": "value"}',
      };

      const generations = [
        {
          content: 'some text',
          role: 'model',
        },
      ];

      const result = handleCompletedStreamingToolCall(
        activeToolCall,
        generations,
      );

      expect(result).toEqual({
        content: {
          parts: [
            {
              functionCall: {
                name: 'test_tool',
                args: { param: 'value' },
                id: 'tool_1',
              },
            },
          ],
          role: 'model',
        },
        index: 0,
        safetyRatings: [],
      });
    });

    it('should handle invalid JSON in arguments buffer', () => {
      const activeToolCall: StreamingToolCall = {
        id: 'tool_1',
        name: 'test_tool',
        argumentsBuffer: 'invalid json',
      };

      const generations = [
        {
          content: 'some text',
          role: 'model',
        },
      ];

      const result = handleCompletedStreamingToolCall(
        activeToolCall,
        generations,
      );

      expect(result).toEqual({
        content: {
          parts: [
            {
              text: 'Error: Failed to parse tool call test_tool',
            },
          ],
          role: 'model',
        },
        index: 0,
        safetyRatings: [],
      });
    });

    it('should handle empty arguments buffer', () => {
      const activeToolCall: StreamingToolCall = {
        id: 'tool_1',
        name: 'test_tool',
        argumentsBuffer: '',
      };

      const generations = [
        {
          content: 'some text',
          role: 'model',
        },
      ];

      const result = handleCompletedStreamingToolCall(
        activeToolCall,
        generations,
      );

      expect(result?.content?.parts?.[0]).toEqual({
        functionCall: {
          name: 'test_tool',
          args: {},
          id: 'tool_1',
        },
      });
    });
  });

  describe('handleStreamingToolInvocations', () => {
    it('should start new tool call with id and name', () => {
      const toolInvocations = [
        {
          id: 'tool_1',
          function: {
            name: 'test_tool',
            arguments: '{"param"',
          },
        },
      ];

      const result = handleStreamingToolInvocations(toolInvocations, null);

      expect(result).toEqual({
        id: 'tool_1',
        name: 'test_tool',
        argumentsBuffer: '{"param"',
      });
    });

    it('should append arguments to existing tool call', () => {
      const activeToolCall: StreamingToolCall = {
        id: 'tool_1',
        name: 'test_tool',
        argumentsBuffer: '{"param"',
      };

      const toolInvocations = [
        {
          id: '',
          function: {
            name: '',
            arguments: ': "value"}',
          },
        },
      ];

      const result = handleStreamingToolInvocations(
        toolInvocations,
        activeToolCall,
      );

      expect(result).toEqual({
        id: 'tool_1',
        name: 'test_tool',
        argumentsBuffer: '{"param": "value"}',
      });
    });

    it('should handle empty tool invocations', () => {
      const result = handleStreamingToolInvocations([], null);
      expect(result).toBe(null);
    });

    it('should handle undefined tool invocations', () => {
      const result = handleStreamingToolInvocations(undefined, null);
      expect(result).toBe(null);
    });

    it('should handle multiple tool invocations', () => {
      const toolInvocations = [
        {
          id: 'tool_1',
          function: {
            name: 'test_tool',
            arguments: '{"param"',
          },
        },
        {
          id: '',
          function: {
            name: '',
            arguments: ': "value"}',
          },
        },
      ];

      const result = handleStreamingToolInvocations(toolInvocations, null);

      expect(result).toEqual({
        id: 'tool_1',
        name: 'test_tool',
        argumentsBuffer: '{"param": "value"}',
      });
    });
  });

  describe('handleTerminalChunk', () => {
    it('should return terminal candidate when usage present and no meaningful content', () => {
      const data: ChatGenerations = {
        id: 'test',
        generation_details: {
          generations: [
            {
              content: '',
              role: 'model',
            },
          ],
          parameters: {
            usage: {
              inputTokens: 10,
              outputTokens: 5,
            },
          },
        },
      };

      const result = handleTerminalChunk(
        data,
        data.generation_details!.generations,
      );

      expect(result).toEqual({
        content: {
          parts: [],
          role: 'model',
        },
        index: 0,
        safetyRatings: [],
        finishReason: 'STOP',
      });
    });

    it('should return terminal candidate with specific finish reason', () => {
      const data: ChatGenerations = {
        id: 'test',
        generation_details: {
          generations: [
            {
              content: 'Hello',
              role: 'model',
              parameters: {
                finish_reason: 'max_tokens',
              },
            },
          ],
        },
      };

      const result = handleTerminalChunk(
        data,
        data.generation_details!.generations,
      );

      expect(result?.finishReason).toBe('MAX_TOKENS');
    });

    it('should map various finish reasons correctly', () => {
      const testCases = [
        { input: 'eos_token', expected: 'STOP' },
        { input: 'stop', expected: 'STOP' },
        { input: 'length', expected: 'MAX_TOKENS' },
        { input: 'max_tokens', expected: 'MAX_TOKENS' },
        { input: 'safety', expected: 'SAFETY' },
        { input: 'recitation', expected: 'RECITATION' },
      ];

      testCases.forEach(({ input, expected }) => {
        const data: ChatGenerations = {
          id: 'test',
          generation_details: {
            generations: [
              {
                content: '', // Use empty content to ensure it's treated as terminal
                role: 'model',
                parameters: {
                  finish_reason: input,
                },
              },
            ],
          },
        };

        const result = handleTerminalChunk(
          data,
          data.generation_details!.generations,
        );
        expect(result?.finishReason).toBe(expected);
      });
    });

    it('should handle unknown finish reasons by not treating them as terminal', () => {
      const data: ChatGenerations = {
        id: 'test',
        generation_details: {
          generations: [
            {
              content: '',
              role: 'model',
              parameters: {
                finish_reason: 'unknown_reason',
              },
            },
          ],
        },
      };

      const result = handleTerminalChunk(
        data,
        data.generation_details!.generations,
      );
      expect(result).toBe(null); // Should not be treated as terminal since unknown_reason is not in the list
    });

    it('should return terminal candidate even with meaningful content when finish reason is present', () => {
      const data: ChatGenerations = {
        id: 'test',
        generation_details: {
          generations: [
            {
              content: 'Hello, world!',
              role: 'model',
              parameters: {
                finish_reason: 'stop',
              },
            },
          ],
        },
      };

      const result = handleTerminalChunk(
        data,
        data.generation_details!.generations,
      );

      expect(result).toEqual({
        content: {
          parts: [],
          role: 'model',
        },
        index: 0,
        safetyRatings: [],
        finishReason: 'STOP',
      });
    });

    it('should return null when not a terminal chunk', () => {
      const data: ChatGenerations = {
        id: 'test',
        generation_details: {
          generations: [
            {
              content: 'Hello, world!',
              role: 'model',
            },
          ],
        },
      };

      const result = handleTerminalChunk(
        data,
        data.generation_details!.generations,
      );
      expect(result).toBe(null);
    });

    it('should return null when generations have tool invocations', () => {
      const data: ChatGenerations = {
        id: 'test',
        generation_details: {
          generations: [
            {
              content: '',
              role: 'model',
              tool_invocations: [
                {
                  id: 'tool_1',
                  function: { name: 'test_tool', arguments: '{}' },
                },
              ],
            },
          ],
          parameters: {
            usage: {
              inputTokens: 10,
              outputTokens: 5,
            },
          },
        },
      };

      const result = handleTerminalChunk(
        data,
        data.generation_details!.generations,
      );
      expect(result).toBe(null);
    });
  });

  describe('handleIncompleteStreamingToolCall', () => {
    it('should log warning when streaming tool calls enabled and active tool call exists', () => {
      const activeToolCall: StreamingToolCall = {
        id: 'tool_1',
        name: 'test_tool',
        argumentsBuffer: '{"incomplete"',
      };

      handleIncompleteStreamingToolCall(true, activeToolCall);

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        '[DEBUG] Stream ended with incomplete tool call:',
        activeToolCall,
      );
    });

    it('should not log when streaming tool calls disabled', () => {
      const activeToolCall: StreamingToolCall = {
        id: 'tool_1',
        name: 'test_tool',
        argumentsBuffer: '{"incomplete"',
      };

      handleIncompleteStreamingToolCall(false, activeToolCall);

      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });

    it('should not log when no active tool call', () => {
      handleIncompleteStreamingToolCall(true, null);

      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });
  });

  describe('processGenerationChunks', () => {
    it('should process text content chunks', () => {
      const generations = [
        {
          content: 'Hello, world!',
          role: 'model',
        },
      ];

      const result = processGenerationChunks(generations, false, null);

      expect(result.candidate).toEqual({
        content: {
          parts: [{ text: 'Hello, world!' }],
          role: 'model',
        },
        index: 0,
        safetyRatings: [],
      });
      expect(result.updatedActiveToolCall).toBe(null);
    });

    it('should process tool invocations in non-streaming mode', () => {
      const generations = [
        {
          content: '',
          role: 'model',
          tool_invocations: [
            {
              id: 'tool_1',
              function: {
                name: 'test_tool',
                arguments: '{"param": "value"}',
              },
            },
          ],
        },
      ];

      const result = processGenerationChunks(generations, false, null);

      expect(result.candidate?.content?.parts).toHaveLength(1);
      expect(result.candidate?.content?.parts?.[0]).toEqual({
        functionCall: {
          name: 'test_tool',
          args: { param: 'value' },
          id: 'tool_1',
        },
      });
    });

    it('should handle streaming tool invocations', () => {
      const generations = [
        {
          content: '',
          role: 'model',
          tool_invocations: [
            {
              id: 'tool_1',
              function: {
                name: 'test_tool',
                arguments: '{"param"',
              },
            },
          ],
        },
      ];

      const result = processGenerationChunks(generations, true, null);

      expect(result.candidate).toBe(null);
      expect(result.updatedActiveToolCall).toEqual({
        id: 'tool_1',
        name: 'test_tool',
        argumentsBuffer: '{"param"',
      });
    });

    it('should merge multiple candidates', () => {
      const generations = [
        {
          content: 'Hello',
          role: 'model',
        },
        {
          content: 'World',
          role: 'model',
        },
      ];

      const result = processGenerationChunks(generations, false, null);

      expect(result.candidate?.content?.parts).toHaveLength(2);
      expect(result.candidate?.content?.parts?.[0]).toEqual({ text: 'Hello' });
      expect(result.candidate?.content?.parts?.[1]).toEqual({ text: 'World' });
    });

    it('should ignore empty content', () => {
      const generations = [
        {
          content: '',
          role: 'model',
        },
        {
          content: '   ',
          role: 'model',
        },
      ];

      const result = processGenerationChunks(generations, false, null);

      expect(result.candidate).toBe(null);
    });

    it('should handle null and undefined content', () => {
      const generations = [
        {
          content: null as unknown as string,
          role: 'model',
        },
        {
          content: undefined as unknown as string,
          role: 'model',
        },
      ];

      const result = processGenerationChunks(generations, false, null);

      expect(result.candidate).toBe(null);
    });
  });

  describe('maybeConstructResponseFormat', () => {
    it('should return response format when all conditions met', () => {
      const request: GenerateContentParameters = {
        model: 'test-model',
        contents: [],
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: {
            type: 'OBJECT',
            properties: {
              name: { type: 'STRING' },
            },
          },
        },
      };

      const model: GatewayModel = {
        supportsStructuredOutput: true,
        description: 'Test model',
        displayId: 'test',
        maxInputTokens: 1000,
        maxOutputTokens: 1000,
        model: 'test-model',
        supportsMcp: true,
        extractUsage: () => undefined,
      };

      const result = maybeConstructResponseFormat(request, model);

      expect(result).toEqual({
        type: 'json_schema',
        json_schema: {
          name: 'response_schema',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
            additionalProperties: false,
          },
        },
      });
    });

    it('should return null when MIME type is not JSON', () => {
      const request: GenerateContentParameters = {
        model: 'test-model',
        contents: [],
        config: {
          responseMimeType: 'text/plain',
          responseJsonSchema: { type: 'object' },
        },
      };

      const model: GatewayModel = {
        supportsStructuredOutput: true,
        description: 'Test model',
        displayId: 'test',
        maxInputTokens: 1000,
        maxOutputTokens: 1000,
        model: 'test-model',
        supportsMcp: true,
        extractUsage: () => undefined,
      };

      const result = maybeConstructResponseFormat(request, model);
      expect(result).toBe(null);
    });

    it('should return null when no response schema', () => {
      const request: GenerateContentParameters = {
        model: 'test-model',
        contents: [],
        config: {
          responseMimeType: 'application/json',
        },
      };

      const model: GatewayModel = {
        supportsStructuredOutput: true,
        description: 'Test model',
        displayId: 'test',
        maxInputTokens: 1000,
        maxOutputTokens: 1000,
        model: 'test-model',
        supportsMcp: true,
        extractUsage: () => undefined,
      };

      const result = maybeConstructResponseFormat(request, model);
      expect(result).toBe(null);
    });

    it('should return null when model does not support structured output', () => {
      const request: GenerateContentParameters = {
        model: 'test-model',
        contents: [],
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: { type: 'object' },
        },
      };

      const model: GatewayModel = {
        supportsStructuredOutput: false,
        description: 'Test model',
        displayId: 'test',
        maxInputTokens: 1000,
        maxOutputTokens: 1000,
        model: 'test-model',
        supportsMcp: true,
        extractUsage: () => undefined,
      };

      const result = maybeConstructResponseFormat(request, model);
      expect(result).toBe(null);
    });

    it('should return null when no config provided', () => {
      const request: GenerateContentParameters = {
        model: 'test-model',
        contents: [],
      };

      const model: GatewayModel = {
        supportsStructuredOutput: true,
        description: 'Test model',
        displayId: 'test',
        maxInputTokens: 1000,
        maxOutputTokens: 1000,
        model: 'test-model',
        supportsMcp: true,
        extractUsage: () => undefined,
      };

      const result = maybeConstructResponseFormat(request, model);
      expect(result).toBe(null);
    });
  });

  describe('maybeInsertJsonInstructions', () => {
    it('should return original content when model supports structured output', () => {
      const request: GenerateContentParameters = {
        model: 'test-model',
        contents: [],
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: { type: 'object' },
        },
      };

      const model: GatewayModel = {
        supportsStructuredOutput: true,
        description: 'Test model',
        displayId: 'test',
        maxInputTokens: 1000,
        maxOutputTokens: 1000,
        model: 'test-model',
        supportsMcp: true,
        extractUsage: () => undefined,
      };

      const messageContent = 'Original message';

      const result = maybeInsertJsonInstructions(
        request,
        model,
        messageContent,
        true,
      );

      expect(result).toBe('Original message');
    });

    it('should insert JSON instructions when conditions met', () => {
      const responseSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      };

      const request: GenerateContentParameters = {
        model: 'test-model',
        contents: [],
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: responseSchema,
        },
      };

      const model: GatewayModel = {
        supportsStructuredOutput: false,
        description: 'Test model',
        displayId: 'test',
        maxInputTokens: 1000,
        maxOutputTokens: 1000,
        model: 'test-model',
        supportsMcp: true,
        extractUsage: () => undefined,
      };

      const messageContent = 'Original message';

      const result = maybeInsertJsonInstructions(
        request,
        model,
        messageContent,
        true,
      );

      expect(result).toContain('Original message');
      expect(result).toContain('⚠️ JSON_ONLY_MODE: CRITICAL OVERRIDE ⚠️');
      expect(result).toContain('You are in JSON-ONLY response mode');
      expect(result).toContain(JSON.stringify(responseSchema, null, 2));
    });

    it('should not insert instructions when not last message', () => {
      const request: GenerateContentParameters = {
        model: 'test-model',
        contents: [],
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: { type: 'object' },
        },
      };

      const model: GatewayModel = {
        supportsStructuredOutput: false,
        description: 'Test model',
        displayId: 'test',
        maxInputTokens: 1000,
        maxOutputTokens: 1000,
        model: 'test-model',
        supportsMcp: true,
        extractUsage: () => undefined,
      };

      const messageContent = 'Original message';

      const result = maybeInsertJsonInstructions(
        request,
        model,
        messageContent,
        false,
      );

      expect(result).toBe('Original message');
    });

    it('should not insert instructions when MIME type is not JSON', () => {
      const request: GenerateContentParameters = {
        model: 'test-model',
        contents: [],
        config: {
          responseMimeType: 'text/plain',
          responseJsonSchema: { type: 'object' },
        },
      };

      const model: GatewayModel = {
        supportsStructuredOutput: false,
        description: 'Test model',
        displayId: 'test',
        maxInputTokens: 1000,
        maxOutputTokens: 1000,
        model: 'test-model',
        supportsMcp: true,
        extractUsage: () => undefined,
      };

      const messageContent = 'Original message';

      const result = maybeInsertJsonInstructions(
        request,
        model,
        messageContent,
        true,
      );

      expect(result).toBe('Original message');
    });

    it('should not insert instructions when no response schema', () => {
      const request: GenerateContentParameters = {
        model: 'test-model',
        contents: [],
        config: {
          responseMimeType: 'application/json',
        },
      };

      const model: GatewayModel = {
        supportsStructuredOutput: false,
        description: 'Test model',
        displayId: 'test',
        maxInputTokens: 1000,
        maxOutputTokens: 1000,
        model: 'test-model',
        supportsMcp: true,
        extractUsage: () => undefined,
      };

      const messageContent = 'Original message';

      const result = maybeInsertJsonInstructions(
        request,
        model,
        messageContent,
        true,
      );

      expect(result).toBe('Original message');
    });
  });
});
