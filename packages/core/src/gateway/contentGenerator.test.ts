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
  GenerateContentParameters,
  CountTokensParameters,
  EmbedContentParameters,
  ToolListUnion,
} from '@google/genai';
import { GenerateContentResponse as GeminiGenerateContentResponse } from '@google/genai';
import { GatewayContentGenerator } from './contentGenerator.js';
import type {
  GatewayClient,
  ChatGenerations,
  GatewayResponse,
} from './client.js';
import { Claude4Sonnet } from './models.js';

// Mock external dependencies
vi.mock('./client.js');
vi.mock('./functionCallAccumulator.js');

// Mock the GatewayClient
const mockGatewayClient = {
  generateChatCompletion: vi.fn(),
  generateChatCompletionStream: vi.fn(),
  createEmbedding: vi.fn(),
} as unknown as GatewayClient;

// Mock the FunctionCallAccumulator
const mockFunctionCallAccumulator = {
  feed: vi.fn(),
  flush: vi.fn(),
  reset: vi.fn(),
} as unknown as import('./functionCallAccumulator.js').FunctionCallAccumulator;

const { GatewayClient: MockGatewayClient } = await import('./client.js');
const { FunctionCallAccumulator } = await import(
  './functionCallAccumulator.js'
);

vi.mocked(MockGatewayClient).mockImplementation(() => mockGatewayClient);
vi.mocked(FunctionCallAccumulator).mockImplementation(
  () => mockFunctionCallAccumulator,
);

describe('GatewayContentGenerator', () => {
  let generator: GatewayContentGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-setup the constructor mocks after clearAllMocks
    vi.mocked(MockGatewayClient).mockImplementation(() => mockGatewayClient);
    vi.mocked(FunctionCallAccumulator).mockImplementation(
      () => mockFunctionCallAccumulator,
    );
    // Reset the function call accumulator mock default behavior
    vi.mocked(mockFunctionCallAccumulator.feed).mockReturnValue({
      text: '',
      calls: [],
    });
    vi.mocked(mockFunctionCallAccumulator.flush).mockReturnValue({
      text: '',
      calls: [],
    });
    vi.mocked(mockFunctionCallAccumulator.reset).mockReturnValue();
    generator = new GatewayContentGenerator();
    // Replace the client instance with our mock
    (generator as unknown as { client: GatewayClient }).client =
      mockGatewayClient;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with Claude4Sonnet model by default', () => {
      expect(generator.model).toBe(Claude4Sonnet);
    });

    it('should create a GatewayClient with the correct model', () => {
      expect(MockGatewayClient).toHaveBeenCalledWith({
        model: Claude4Sonnet,
      });
    });
  });

  describe('generateContent', () => {
    it('should generate content successfully with tool response', async () => {
      const mockGatewayResponse: GatewayResponse<ChatGenerations> = {
        data: {
          id: 'test-id',
          generation_details: {
            generations: [
              {
                content: '',
                role: 'assistant',
                tool_invocations: [
                  {
                    id: 'test-call-1',
                    function: {
                      name: 'respond',
                      arguments: '{"text": "Hello, how can I help you?"}',
                    },
                  },
                ],
              },
            ],
            parameters: {
              usage: {
                inputTokens: 10,
                outputTokens: 8,
                totalTokens: 18,
              },
            },
          },
        },
        status: 200,
        headers: {},
      };

      const request: GenerateContentParameters = {
        model: 'test-model',
        contents: 'Hello',
      };

      vi.mocked(mockGatewayClient.generateChatCompletion).mockResolvedValue(
        mockGatewayResponse,
      );

      const result = await generator.generateContent(request, 'test-prompt-id');

      expect(mockGatewayClient.generateChatCompletion).toHaveBeenCalledWith({
        model: Claude4Sonnet.model,
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
        generation_settings: {
          max_tokens: Claude4Sonnet.maxOutputTokens,
          temperature: 0.7,
        },
      });

      expect(result).toBeInstanceOf(GeminiGenerateContentResponse);
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates?.[0]?.content?.parts![0]).toEqual({
        functionCall: {
          name: 'respond',
          args: { text: 'Hello, how can I help you?' },
          id: 'test-call-1',
        },
      });
      expect(result.usageMetadata).toEqual({
        promptTokenCount: 10,
        candidatesTokenCount: 8,
        totalTokenCount: 18,
      });
    });

    it('should handle system instruction correctly', async () => {
      const mockGatewayResponse: GatewayResponse<ChatGenerations> = {
        data: {
          id: 'test-id',
          generation_details: {
            generations: [
              {
                content: '',
                role: 'assistant',
                tool_invocations: [
                  {
                    id: 'sys-call-1',
                    function: {
                      name: 'respond',
                      arguments: '{"text": "System instruction processed"}',
                    },
                  },
                ],
              },
            ],
          },
        },
        status: 200,
        headers: {},
      };

      vi.mocked(mockGatewayClient.generateChatCompletion).mockResolvedValue(
        mockGatewayResponse,
      );

      const request: GenerateContentParameters = {
        model: 'test-model',
        contents: 'Hello',
        config: {
          systemInstruction: 'You are a helpful assistant.',
        },
      };

      await generator.generateContent(request, 'test-prompt-id');

      expect(mockGatewayClient.generateChatCompletion).toHaveBeenCalledWith({
        model: Claude4Sonnet.model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant.',
          },
          {
            role: 'user',
            content: 'Hello',
          },
        ],
        generation_settings: {
          max_tokens: Claude4Sonnet.maxOutputTokens,
          temperature: 0.7,
        },
      });
    });

    it('should handle tools correctly', async () => {
      const mockGatewayResponse: GatewayResponse<ChatGenerations> = {
        data: {
          id: 'test-id',
          generation_details: {
            generations: [
              {
                content: '',
                role: 'assistant',
                tool_invocations: [
                  {
                    id: 'call-1',
                    function: {
                      name: 'get_weather',
                      arguments: '{"location": "San Francisco"}',
                    },
                  },
                ],
              },
            ],
          },
        },
        status: 200,
        headers: {},
      };

      vi.mocked(mockGatewayClient.generateChatCompletion).mockResolvedValue(
        mockGatewayResponse,
      );

      const tools: ToolListUnion = [
        {
          functionDeclarations: [
            {
              name: 'get_weather',
              description: 'Get weather information',
              parametersJsonSchema: {
                type: 'object',
                properties: {
                  location: { type: 'string' },
                },
                required: ['location'],
              },
            },
          ],
        },
      ];

      const request: GenerateContentParameters = {
        model: 'test-model',
        contents: 'What is the weather in San Francisco?',
        config: {
          tools,
        },
      };

      const result = await generator.generateContent(request, 'test-prompt-id');

      expect(mockGatewayClient.generateChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: [
            {
              type: 'function',
              function: {
                name: 'get_weather',
                description: 'Get weather information',
                parameters: {
                  type: 'object',
                  properties: {
                    location: { type: 'string' },
                  },
                  required: ['location'],
                },
              },
            },
          ],
          tool_config: {
            mode: 'auto',
            parallel_calls: true,
          },
        }),
      );

      expect(result.candidates?.[0]?.content?.parts![0]).toEqual({
        functionCall: {
          name: 'get_weather',
          args: { location: 'San Francisco' },
          id: 'call-1',
        },
      });
    });

    it('should handle tool parameter mapping for read_file', async () => {
      const mockGatewayResponse: GatewayResponse<ChatGenerations> = {
        data: {
          id: 'test-id',
          generation_details: {
            generations: [
              {
                content: '',
                role: 'assistant',
                tool_invocations: [
                  {
                    id: 'call-1',
                    function: {
                      name: 'read_file',
                      arguments: '{"file_path": "/path/to/file.txt"}',
                    },
                  },
                ],
              },
            ],
          },
        },
        status: 200,
        headers: {},
      };

      vi.mocked(mockGatewayClient.generateChatCompletion).mockResolvedValue(
        mockGatewayResponse,
      );

      const request: GenerateContentParameters = {
        model: 'test-model',
        contents: 'Read the file',
        config: {
          tools: [
            {
              functionDeclarations: [
                {
                  name: 'read_file',
                  description: 'Read a file',
                  parametersJsonSchema: {
                    type: 'object',
                    properties: {
                      file_path: { type: 'string' },
                    },
                  },
                },
              ],
            },
          ],
        },
      };

      const result = await generator.generateContent(request, 'test-prompt-id');

      // Should map file_path to absolute_path for read_file tool
      expect(result.candidates?.[0]?.content?.parts![0]).toEqual({
        functionCall: {
          name: 'read_file',
          args: { absolute_path: '/path/to/file.txt' },
          id: 'call-1',
        },
      });
    });

    it('should handle generation settings correctly', async () => {
      const mockGatewayResponse: GatewayResponse<ChatGenerations> = {
        data: {
          id: 'test-id',
          generation_details: {
            generations: [
              {
                content: '',
                role: 'assistant',
                tool_invocations: [
                  {
                    id: 'settings-call',
                    function: {
                      name: 'respond',
                      arguments: '{"text": "Response"}',
                    },
                  },
                ],
              },
            ],
          },
        },
        status: 200,
        headers: {},
      };

      vi.mocked(mockGatewayClient.generateChatCompletion).mockResolvedValue(
        mockGatewayResponse,
      );

      const request: GenerateContentParameters = {
        model: 'test-model',
        contents: 'Test',
        config: {
          maxOutputTokens: 1000,
          temperature: 0.5,
          stopSequences: ['STOP'],
        },
      };

      await generator.generateContent(request, 'test-prompt-id');

      expect(mockGatewayClient.generateChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          generation_settings: {
            max_tokens: 1000,
            temperature: 0.5,
            stop_sequences: ['STOP'],
          },
        }),
      );
    });
  });

  describe('generateContentStream', () => {
    it('should stream content successfully with text responses', async () => {
      const mockStreamData = [
        {
          id: 'stream-1',
          generation_details: {
            generations: [
              {
                content: 'Hello',
                role: 'assistant' as const,
              },
            ],
            parameters: {
              usage: {
                inputTokens: 5,
                outputTokens: 2,
                totalTokens: 7,
              },
            },
          },
        },
        {
          id: 'stream-1',
          generation_details: {
            generations: [
              {
                content: ' world!',
                role: 'assistant' as const,
              },
            ],
            parameters: {
              usage: {
                inputTokens: 5,
                outputTokens: 4,
                totalTokens: 9,
              },
            },
          },
        },
      ];

      // Mock the accumulator to return text progressively
      vi.mocked(mockFunctionCallAccumulator.feed)
        .mockReturnValueOnce({
          text: 'Hello',
          calls: [],
        })
        .mockReturnValueOnce({
          text: ' world!',
          calls: [],
        });

      vi.mocked(mockFunctionCallAccumulator.flush).mockReturnValue({
        text: '',
        calls: [],
      });

      async function* mockStreamGenerator() {
        for (const data of mockStreamData) {
          yield data;
        }
      }

      vi.mocked(
        mockGatewayClient.generateChatCompletionStream,
      ).mockResolvedValue(mockStreamGenerator());

      const request: GenerateContentParameters = {
        model: 'test-model',
        contents: 'Say hello',
      };

      const streamGenerator = await generator.generateContentStream(
        request,
        'test-prompt-id',
      );

      const results = [];
      for await (const response of streamGenerator) {
        results.push(response);
      }

      expect(results).toHaveLength(2);
      expect(results[0]?.candidates?.[0]?.content?.parts?.[0]).toEqual({
        text: 'Hello',
      });
      expect(results[1]?.candidates?.[0]?.content?.parts?.[0]).toEqual({
        text: ' world!',
      });

      // Check usage metadata is updated
      expect(results[1]?.usageMetadata).toEqual({
        promptTokenCount: 5,
        candidatesTokenCount: 4,
        totalTokenCount: 9,
      });
    });

    it('should handle streaming with function calls', async () => {
      const mockStreamData = [
        {
          id: 'stream-func-1',
          generation_details: {
            generations: [
              {
                content: '',
                role: 'assistant' as const,
                tool_invocations: [
                  {
                    id: 'func-call-1',
                    function: {
                      name: 'get_weather',
                      arguments: '{"location": "New York"}',
                    },
                  },
                ],
              },
            ],
          },
        },
      ];

      async function* mockStreamGenerator() {
        for (const data of mockStreamData) {
          yield data;
        }
      }

      vi.mocked(
        mockGatewayClient.generateChatCompletionStream,
      ).mockResolvedValue(mockStreamGenerator());

      const request: GenerateContentParameters = {
        model: 'test-model',
        contents: 'What is the weather in New York?',
        config: {
          tools: [
            {
              functionDeclarations: [
                {
                  name: 'get_weather',
                  description: 'Get weather information',
                  parametersJsonSchema: {
                    type: 'object',
                    properties: {
                      location: { type: 'string' },
                    },
                  },
                },
              ],
            },
          ],
        },
      };

      const streamGenerator = await generator.generateContentStream(
        request,
        'test-prompt-id',
      );

      const results = [];
      for await (const response of streamGenerator) {
        results.push(response);
      }

      expect(results).toHaveLength(1);
      expect(results[0]?.candidates?.[0]?.content?.parts?.[0]).toEqual({
        functionCall: {
          name: 'get_weather',
          args: { location: 'New York' },
          id: 'func-call-1',
        },
      });
    });

    it('should handle streaming with function call accumulation', async () => {
      const mockStreamData = [
        {
          id: 'stream-accum-1',
          generation_details: {
            generations: [
              {
                content: '<function_calls>',
                role: 'assistant' as const,
              },
            ],
          },
        },
        {
          id: 'stream-accum-1',
          generation_details: {
            generations: [
              {
                content: '\n<invoke name="test_func">',
                role: 'assistant' as const,
              },
            ],
          },
        },
        {
          id: 'stream-accum-1',
          generation_details: {
            generations: [
              {
                content: '\n<parameter name="param1">value1</parameter>',
                role: 'assistant' as const,
              },
            ],
          },
        },
        {
          id: 'stream-accum-1',
          generation_details: {
            generations: [
              {
                content: '\n</invoke>\n</function_calls>',
                role: 'assistant' as const,
              },
            ],
          },
        },
      ];

      // Mock the accumulator to simulate function call parsing
      vi.mocked(mockFunctionCallAccumulator.feed)
        .mockReturnValueOnce({ text: '', calls: [] })
        .mockReturnValueOnce({ text: '', calls: [] })
        .mockReturnValueOnce({ text: '', calls: [] })
        .mockReturnValueOnce({
          text: '',
          calls: [
            {
              id: 'accumulated-call-1',
              name: 'test_func',
              args: { param1: 'value1' },
            },
          ],
        });

      vi.mocked(mockFunctionCallAccumulator.flush).mockReturnValue({
        text: '',
        calls: [],
      });

      async function* mockStreamGenerator() {
        for (const data of mockStreamData) {
          yield data;
        }
      }

      vi.mocked(
        mockGatewayClient.generateChatCompletionStream,
      ).mockResolvedValue(mockStreamGenerator());

      const request: GenerateContentParameters = {
        model: 'test-model',
        contents: 'Call test function',
      };

      const streamGenerator = await generator.generateContentStream(
        request,
        'test-prompt-id',
      );

      const results = [];
      for await (const response of streamGenerator) {
        results.push(response);
      }

      // Should have 4 responses, with the last one containing the function call
      expect(results).toHaveLength(4);
      const lastResult = results[3];
      expect(lastResult?.candidates?.[0]?.content?.parts?.[0]).toEqual({
        functionCall: {
          name: 'test_func',
          args: { param1: 'value1' },
          id: 'accumulated-call-1',
        },
      });
    });

    it('should handle parameter mapping in streaming function calls', async () => {
      const mockStreamData = [
        {
          id: 'stream-mapping-1',
          generation_details: {
            generations: [
              {
                content: '',
                role: 'assistant' as const,
                tool_invocations: [
                  {
                    id: 'mapping-call-1',
                    function: {
                      name: 'read_file',
                      arguments: '{"file_path": "/path/to/file.txt"}',
                    },
                  },
                ],
              },
            ],
          },
        },
      ];

      async function* mockStreamGenerator() {
        for (const data of mockStreamData) {
          yield data;
        }
      }

      vi.mocked(
        mockGatewayClient.generateChatCompletionStream,
      ).mockResolvedValue(mockStreamGenerator());

      const request: GenerateContentParameters = {
        model: 'test-model',
        contents: 'Read the file',
      };

      const streamGenerator = await generator.generateContentStream(
        request,
        'test-prompt-id',
      );

      const results = [];
      for await (const response of streamGenerator) {
        results.push(response);
      }

      expect(results).toHaveLength(1);
      // Should map file_path to absolute_path for read_file tool
      expect(results[0]?.candidates?.[0]?.content?.parts?.[0]).toEqual({
        functionCall: {
          name: 'read_file',
          args: { absolute_path: '/path/to/file.txt' },
          id: 'mapping-call-1',
        },
      });
    });

    it('should handle streaming errors gracefully', async () => {
      async function* mockStreamGenerator() {
        yield {
          id: 'error-stream-1',
          generation_details: {
            generations: [
              {
                content: 'Before error',
                role: 'assistant' as const,
              },
            ],
          },
        };
        throw new Error('Stream error');
      }

      vi.mocked(
        mockGatewayClient.generateChatCompletionStream,
      ).mockResolvedValue(mockStreamGenerator());

      vi.mocked(mockFunctionCallAccumulator.feed).mockReturnValue({
        text: 'Before error',
        calls: [],
      });

      const request: GenerateContentParameters = {
        model: 'test-model',
        contents: 'Test error',
      };

      const streamGenerator = await generator.generateContentStream(
        request,
        'test-prompt-id',
      );

      const results = [];
      let error: Error | null = null;

      try {
        for await (const response of streamGenerator) {
          results.push(response);
        }
      } catch (e) {
        error = e as Error;
      }

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('Stream error');
      expect(results).toHaveLength(1); // Should have processed one response before error
    });

    it('should handle accumulator flush at end of stream', async () => {
      const mockStreamData = [
        {
          id: 'stream-flush-1',
          generation_details: {
            generations: [
              {
                content: 'Some text',
                role: 'assistant' as const,
              },
            ],
          },
        },
      ];

      // Mock feed to return empty, but flush to return content
      vi.mocked(mockFunctionCallAccumulator.feed).mockReturnValue({
        text: '',
        calls: [],
      });

      vi.mocked(mockFunctionCallAccumulator.flush).mockReturnValue({
        text: 'Final accumulated text',
        calls: [
          {
            id: 'flush-call-1',
            name: 'final_func',
            args: { data: 'final' },
          },
        ],
      });

      async function* mockStreamGenerator() {
        for (const data of mockStreamData) {
          yield data;
        }
      }

      vi.mocked(
        mockGatewayClient.generateChatCompletionStream,
      ).mockResolvedValue(mockStreamGenerator());

      const request: GenerateContentParameters = {
        model: 'test-model',
        contents: 'Test flush',
      };

      const streamGenerator = await generator.generateContentStream(
        request,
        'test-prompt-id',
      );

      const results = [];
      for await (const response of streamGenerator) {
        results.push(response);
      }

      // Should have 2 responses: one from the stream, one from flush
      expect(results).toHaveLength(2);

      // First response should be empty (since feed returned empty)
      expect(results[0]?.candidates).toHaveLength(0);

      // Second response should contain flush results
      const flushResponse = results[1];
      expect(flushResponse?.candidates).toHaveLength(2);

      // Should have function call and text from flush
      expect(flushResponse?.candidates?.[0]?.content?.parts?.[0]).toEqual({
        functionCall: {
          name: 'final_func',
          args: { data: 'final' },
          id: 'flush-call-1',
        },
      });
      expect(flushResponse?.candidates?.[1]?.content?.parts?.[0]).toEqual({
        text: 'Final accumulated text',
      });
    });

    it('should reset accumulator for new generation sequences', async () => {
      const mockStreamData = [
        {
          id: 'stream-reset-1',
          generation_details: {
            generations: [
              {
                content: 'First generation',
                role: 'assistant' as const,
              },
            ],
          },
        },
        {
          id: 'stream-reset-2', // Different ID should trigger reset
          generation_details: {
            generations: [
              {
                content: 'Second generation',
                role: 'assistant' as const,
              },
            ],
          },
        },
      ];

      vi.mocked(mockFunctionCallAccumulator.feed)
        .mockReturnValueOnce({ text: 'First generation', calls: [] })
        .mockReturnValueOnce({ text: 'Second generation', calls: [] });

      vi.mocked(mockFunctionCallAccumulator.flush).mockReturnValue({
        text: '',
        calls: [],
      });

      async function* mockStreamGenerator() {
        for (const data of mockStreamData) {
          yield data;
        }
      }

      vi.mocked(
        mockGatewayClient.generateChatCompletionStream,
      ).mockResolvedValue(mockStreamGenerator());

      const request: GenerateContentParameters = {
        model: 'test-model',
        contents: 'Test reset',
      };

      const streamGenerator = await generator.generateContentStream(
        request,
        'test-prompt-id',
      );

      const results = [];
      for await (const response of streamGenerator) {
        results.push(response);
      }

      // Should call reset when ID changes (at least once)
      expect(mockFunctionCallAccumulator.reset).toHaveBeenCalled();
      expect(results).toHaveLength(2);
    });
  });

  describe('countTokens', () => {
    it('should return cached usage statistics', async () => {
      // Set some usage first by calling generateContent
      const mockGatewayResponse: GatewayResponse<ChatGenerations> = {
        data: {
          id: 'test-id',
          generation_details: {
            parameters: {
              usage: {
                inputTokens: 50,
                outputTokens: 30,
                totalTokens: 80,
              },
            },
            generations: [
              {
                content: '',
                role: 'assistant',
                tool_invocations: [
                  {
                    id: 'token-call',
                    function: {
                      name: 'respond',
                      arguments: '{"text": "Test"}',
                    },
                  },
                ],
              },
            ],
          },
        },
        status: 200,
        headers: {},
      };

      vi.mocked(mockGatewayClient.generateChatCompletion).mockResolvedValue(
        mockGatewayResponse,
      );

      await generator.generateContent(
        { model: 'test-model', contents: 'Test' },
        'test-prompt-id',
      );

      const countRequest: CountTokensParameters = {
        model: 'test-model',
        contents: 'Some content',
      };

      const result = await generator.countTokens(countRequest);

      expect(result).toEqual({
        totalTokens: 80,
      });
    });

    it('should return default usage when no previous usage', async () => {
      const countRequest: CountTokensParameters = {
        model: 'test-model',
        contents: 'Some content',
      };

      const result = await generator.countTokens(countRequest);

      expect(result).toEqual({
        totalTokens: 0,
      });
    });
  });

  describe('embedContent', () => {
    it('should create embeddings successfully', async () => {
      const mockEmbeddingResponse: GatewayResponse = {
        data: {
          embeddings: [
            {
              values: [0.1, 0.2, 0.3, 0.4, 0.5],
            },
          ],
        },
        status: 200,
        headers: {},
      };

      vi.mocked(mockGatewayClient.createEmbedding).mockResolvedValue(
        mockEmbeddingResponse,
      );

      const request: EmbedContentParameters = {
        model: 'test-model',
        contents: 'Text to embed',
      };

      const result = await generator.embedContent(request);

      expect(mockGatewayClient.createEmbedding).toHaveBeenCalledWith({
        input: ['Text to embed'],
        model: 'text-embedding-model',
      });

      expect(result).toEqual({
        embeddings: [
          {
            values: [0.1, 0.2, 0.3, 0.4, 0.5],
          },
        ],
      });
    });
  });

  describe('parameter schema normalization', () => {
    it('should normalize uppercase types to lowercase', async () => {
      const mockGatewayResponse: GatewayResponse<ChatGenerations> = {
        data: {
          id: 'test-id',
          generation_details: {
            generations: [
              {
                content: '',
                role: 'assistant',
                tool_invocations: [
                  {
                    id: 'norm-call',
                    function: {
                      name: 'respond',
                      arguments: '{"text": "Response"}',
                    },
                  },
                ],
              },
            ],
          },
        },
        status: 200,
        headers: {},
      };

      vi.mocked(mockGatewayClient.generateChatCompletion).mockResolvedValue(
        mockGatewayResponse,
      );

      const tools: ToolListUnion = [
        {
          functionDeclarations: [
            {
              name: 'test_function',
              description: 'Test function',
              parametersJsonSchema: {
                type: 'OBJECT', // Uppercase - should be normalized
                properties: {
                  param1: { type: 'STRING' }, // Uppercase - should be normalized
                  param2: {
                    type: 'ARRAY', // Uppercase - should be normalized
                    items: { type: 'NUMBER' }, // Uppercase - should be normalized
                  },
                },
              },
            },
          ],
        },
      ];

      const request: GenerateContentParameters = {
        model: 'test-model',
        contents: 'Test',
        config: { tools },
      };

      await generator.generateContent(request, 'test-prompt-id');

      const call = vi.mocked(mockGatewayClient.generateChatCompletion).mock
        .calls[0]![0];
      const normalizedTool = call.tools![0]!;
      expect(normalizedTool.function!.parameters).toEqual({
        type: 'object', // normalized to lowercase
        properties: {
          param1: { type: 'string' }, // normalized to lowercase
          param2: {
            type: 'array', // normalized to lowercase
            items: { type: 'number' }, // normalized to lowercase
          },
        },
      });
    });
  });

  describe('content conversion utilities', () => {
    it('should convert string content correctly', () => {
      const request: GenerateContentParameters = {
        model: 'test-model',
        contents: 'Simple string',
      };

      // Access private method for testing
      const gatewayRequest = (
        generator as unknown as {
          prepareGatewayRequest: (req: GenerateContentParameters) => {
            messages: Array<{ role: string; content: string }>;
          };
        }
      ).prepareGatewayRequest(request);

      expect(gatewayRequest.messages).toEqual([
        {
          role: 'user',
          content: 'Simple string',
        },
      ]);
    });

    it('should handle Content objects with roles', () => {
      const request: GenerateContentParameters = {
        model: 'test-model',
        contents: [
          {
            role: 'user',
            parts: [{ text: 'User message' }],
          },
          {
            role: 'model',
            parts: [{ text: 'Model response' }],
          },
        ],
      };

      const gatewayRequest = (
        generator as unknown as {
          prepareGatewayRequest: (req: GenerateContentParameters) => {
            messages: Array<{ role: string; content: string }>;
          };
        }
      ).prepareGatewayRequest(request);

      expect(gatewayRequest.messages).toEqual([
        {
          role: 'user',
          content: 'User message',
        },
        {
          role: 'assistant',
          content: 'Model response',
        },
      ]);
    });
  });

  describe('error handling', () => {
    it('should handle gateway client errors', async () => {
      vi.mocked(mockGatewayClient.generateChatCompletion).mockRejectedValue(
        new Error('Gateway error'),
      );

      const request: GenerateContentParameters = {
        model: 'test-model',
        contents: 'Test',
      };

      await expect(
        generator.generateContent(request, 'test-prompt-id'),
      ).rejects.toThrow('Gateway error');
    });

    it('should handle embedding errors', async () => {
      vi.mocked(mockGatewayClient.createEmbedding).mockRejectedValue(
        new Error('Embedding error'),
      );

      const request: EmbedContentParameters = {
        model: 'test-model',
        contents: 'Test',
      };

      await expect(generator.embedContent(request)).rejects.toThrow(
        'Embedding error',
      );
    });
  });
});
