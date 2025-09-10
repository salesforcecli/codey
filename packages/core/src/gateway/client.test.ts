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
import { randomBytes } from 'node:crypto';
import { createParser } from 'eventsource-parser';
import { request } from 'undici';
import { Org } from '@salesforce/core';
import { GatewayClient } from './client.js';
import { JSONWebToken } from './jwt.js';
import * as env from './env.js';
import * as models from './models.js';
import { defaultExtractUsage } from './models.js';

// Mock external dependencies at the top for proper hoisting
vi.mock('undici');
vi.mock('@salesforce/core');
vi.mock('node:crypto');
vi.mock('eventsource-parser');
vi.mock('./jwt.js');
vi.mock('./env.js');
vi.mock('./models.js');

describe('GatewayClient', () => {
  let client: GatewayClient;
  let mockJWT: {
    isExpired: ReturnType<typeof vi.fn>;
    value: ReturnType<typeof vi.fn>;
    tnk: ReturnType<typeof vi.fn>;
  };
  let mockOrg: {
    getConnection: ReturnType<typeof vi.fn>;
  };
  let mockConnection: {
    instanceUrl: string;
    request: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // Mock environment functions
    vi.mocked(env.resolveSfApiEnv).mockReturnValue('prod');
    vi.mocked(env.getSalesforceRegionHeader).mockReturnValue('EAST_REGION_1');
    vi.mocked(env.getSalesforceBaseUrl).mockReturnValue(
      'https://api.salesforce.com',
    );

    // Mock models
    const mockDefaultModel = {
      description: 'Default model',
      displayId: 'default',
      model: 'default-model',
      maxInputTokens: 4096,
      maxOutputTokens: 2048,
      customHeaders: { 'x-custom': 'InternalTextGeneration' },
      supportsMcp: true,
      extractUsage: defaultExtractUsage,
    };
    vi.mocked(models.findGatewayModel).mockReturnValue(undefined);
    vi.mocked(models.getModelOrDefault).mockReturnValue(mockDefaultModel);

    // Mock crypto
    vi.mocked(randomBytes).mockImplementation((size: number) => {
      const buffer = Buffer.alloc(size);
      buffer.fill(0xab);
      return buffer;
    });

    // Mock JWT
    mockJWT = {
      isExpired: vi.fn().mockReturnValue(false),
      value: vi.fn().mockReturnValue('mock-jwt-token'),
      tnk: vi.fn().mockReturnValue('mock-tenant-id'),
    };
    vi.mocked(JSONWebToken).mockImplementation(
      () => mockJWT as unknown as JSONWebToken,
    );

    // Mock Salesforce connection
    mockConnection = {
      instanceUrl: 'https://test.salesforce.com',
      request: vi.fn(),
    };
    mockOrg = {
      getConnection: vi.fn().mockReturnValue(mockConnection),
    };
    vi.mocked(Org.create).mockResolvedValue(mockOrg as unknown as Org);

    // Mock undici request
    vi.mocked(request).mockResolvedValue({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        json: vi.fn().mockResolvedValue({ data: 'mock response' }),
      },
    } as unknown as Awaited<ReturnType<typeof request>>);

    // Set environment variable
    process.env['CODEY_ORG_USERNAME'] = 'test@example.com';

    client = new GatewayClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env['CODEY_ORG_USERNAME'];
  });

  describe('constructor', () => {
    it('should initialize with correct base URL and region header', () => {
      expect(env.resolveSfApiEnv).toHaveBeenCalled();
      expect(env.getSalesforceRegionHeader).toHaveBeenCalledWith('prod');
      expect(env.getSalesforceBaseUrl).toHaveBeenCalledWith('prod');
    });
  });

  describe('maybeRequestJWT', () => {
    it('should skip JWT request if JWT exists and is not expired', async () => {
      // Setup existing JWT
      (client as unknown as { jwt: typeof mockJWT })['jwt'] = mockJWT;
      mockJWT.isExpired.mockReturnValue(false);

      await client.maybeRequestJWT();

      expect(Org.create).not.toHaveBeenCalled();
      expect(mockJWT.isExpired).toHaveBeenCalled();
    });

    it('should request new JWT if no JWT exists', async () => {
      mockConnection.request.mockResolvedValue({ jwt: 'new-jwt-token' });

      await client.maybeRequestJWT();

      expect(Org.create).toHaveBeenCalledWith({
        aliasOrUsername: 'test@example.com',
      });
      expect(mockConnection.request).toHaveBeenCalledWith({
        method: 'POST',
        url: 'https://test.salesforce.com/ide/auth',
        body: '{}',
      });
      expect(JSONWebToken).toHaveBeenCalledWith({ jwt: 'new-jwt-token' });
    });

    it('should request new JWT if existing JWT is expired', async () => {
      (client as unknown as { jwt: typeof mockJWT })['jwt'] = mockJWT;
      mockJWT.isExpired.mockReturnValue(true);
      mockConnection.request.mockResolvedValue({ jwt: 'refreshed-jwt-token' });

      await client.maybeRequestJWT();

      expect(mockJWT.isExpired).toHaveBeenCalled();
      expect(Org.create).toHaveBeenCalledWith({
        aliasOrUsername: 'test@example.com',
      });
      expect(JSONWebToken).toHaveBeenCalledWith({ jwt: 'refreshed-jwt-token' });
    });

    it('should throw error if CODEY_ORG_USERNAME is not set', async () => {
      delete process.env['CODEY_ORG_USERNAME'];

      await expect(client.maybeRequestJWT()).rejects.toThrow(
        'CODEY_ORG_USERNAME is required for SF LLMG auth',
      );
    });

    it('should throw error if JWT is not returned from auth endpoint', async () => {
      mockConnection.request.mockResolvedValue({});

      await expect(client.maybeRequestJWT()).rejects.toThrow(
        'Failed to obtain JWT from /ide/auth',
      );
    });

    it('should throw error if JWT is null', async () => {
      mockConnection.request.mockResolvedValue({ jwt: null });

      await expect(client.maybeRequestJWT()).rejects.toThrow(
        'Failed to obtain JWT from /ide/auth',
      );
    });
  });

  describe('generateCompletion', () => {
    const mockRequest = {
      prompt: 'Hello, world!',
      model: 'test-model',
      max_tokens: 100,
    };

    beforeEach(() => {
      (client as unknown as { jwt: typeof mockJWT })['jwt'] = mockJWT;
    });

    it('should make successful completion request', async () => {
      const mockResponse = {
        id: 'gen-123',
        generations: [{ text: 'Hello there!' }],
      };
      vi.mocked(request).mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: { json: vi.fn().mockResolvedValue(mockResponse) },
      } as unknown as Awaited<ReturnType<typeof request>>);

      const result = await client.generateCompletion(mockRequest);

      expect(request).toHaveBeenCalledWith(
        'https://api.salesforce.com/einstein/gpt/code/v1.1/generations',
        {
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-jwt-token',
            'Content-Type': 'application/json;charset=utf-8',
            'x-client-feature-id': 'EinsteinGptForDevelopers',
            'x-sfdc-app-context': 'EinsteinGPT',
            'x-sfdc-core-tenant-id': 'mock-tenant-id',
            'x-salesforce-region': 'EAST_REGION_1',
            'x-client-trace-id': expect.any(String),
            'x-custom': 'InternalTextGeneration',
          }),
          body: JSON.stringify(mockRequest),
        },
      );
      expect(result.data).toEqual(mockResponse);
      expect(result.status).toBe(200);
    });

    it('should throw error for failed request', async () => {
      vi.mocked(request).mockResolvedValue({
        statusCode: 400,
        headers: {},
        body: { json: vi.fn().mockResolvedValue({ message: 'Bad Request' }) },
      } as unknown as Awaited<ReturnType<typeof request>>);

      await expect(client.generateCompletion(mockRequest)).rejects.toThrow(
        'Gateway API Error: 400 - Bad Request.',
      );
    });

    it('should handle error without message', async () => {
      vi.mocked(request).mockResolvedValue({
        statusCode: 500,
        headers: {},
        body: { json: vi.fn().mockResolvedValue({}) },
      } as unknown as Awaited<ReturnType<typeof request>>);

      await expect(client.generateCompletion(mockRequest)).rejects.toThrow(
        'Gateway API Error: 500 - Request failed.',
      );
    });
  });

  describe('generateCompletionStream', () => {
    const mockRequest = {
      prompt: 'Hello, world!',
      model: 'test-model',
    };

    beforeEach(() => {
      (client as unknown as { jwt: typeof mockJWT })['jwt'] = mockJWT;
    });

    it('should handle successful stream request', async () => {
      const mockResponseData = {
        id: 'gen-123',
        generations: [{ text: 'Hello' }],
      };
      const mockParser = {
        feed: vi.fn(),
      };
      const mockAsyncIterator = {
        [Symbol.asyncIterator]: () => ({
          next: vi
            .fn()
            .mockResolvedValueOnce({
              value: Buffer.from(
                'data: ' + JSON.stringify(mockResponseData) + '\n\n',
              ),
              done: false,
            })
            .mockResolvedValue({ done: true }),
        }),
      };

      vi.mocked(createParser).mockImplementation(({ onEvent }) => {
        // Simulate parser calling onEvent when feed is called
        mockParser.feed = vi.fn().mockImplementation((data) => {
          if (data.includes('data: ')) {
            const jsonData = data.replace('data: ', '').trim();
            onEvent?.({ event: 'data', data: jsonData });
          }
        });
        return mockParser as unknown as ReturnType<typeof createParser>;
      });

      vi.mocked(request).mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: mockAsyncIterator,
      } as unknown as Awaited<ReturnType<typeof request>>);

      const generator = await client.generateCompletionStream(mockRequest);
      const results = [];

      for await (const chunk of generator) {
        results.push(chunk);
      }

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(mockResponseData);
    });

    it('should throw error for failed stream request', async () => {
      vi.mocked(request).mockResolvedValue({
        statusCode: 400,
        headers: {},
        body: { json: vi.fn().mockResolvedValue({ message: 'Bad Request' }) },
      } as unknown as Awaited<ReturnType<typeof request>>);

      await expect(
        client.generateCompletionStream(mockRequest),
      ).rejects.toThrow('Gateway API Error: 400 - Bad Request');
    });

    it('should skip irrelevant events', async () => {
      const mockParser = {
        feed: vi.fn(),
      };
      const mockAsyncIterator = {
        [Symbol.asyncIterator]: () => ({
          next: vi
            .fn()
            .mockResolvedValueOnce({
              value: Buffer.from('event: scores\ndata: {}\n\n'),
              done: false,
            })
            .mockResolvedValueOnce({
              value: Buffer.from('data: [DONE]\n\n'),
              done: false,
            })
            .mockResolvedValue({ done: true }),
        }),
      };

      vi.mocked(createParser).mockImplementation(({ onEvent }) => {
        mockParser.feed = vi.fn().mockImplementation((data) => {
          if (data.includes('event: scores')) {
            onEvent?.({ event: 'scores', data: '{}' });
          }
          if (data.includes('data: [DONE]')) {
            onEvent?.({ event: 'data', data: '[DONE]' });
          }
        });
        return mockParser as unknown as ReturnType<typeof createParser>;
      });

      vi.mocked(request).mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: mockAsyncIterator,
      } as unknown as Awaited<ReturnType<typeof request>>);

      const generator = await client.generateCompletionStream(mockRequest);
      const results = [];

      for await (const chunk of generator) {
        results.push(chunk);
      }

      expect(results).toHaveLength(0);
    });
  });

  describe('generateChatCompletion', () => {
    const mockRequest = {
      model: 'test-model',
      messages: [{ role: 'user' as const, content: 'Hello!' }],
    };

    beforeEach(() => {
      (client as unknown as { jwt: typeof mockJWT })['jwt'] = mockJWT;
    });

    it('should make successful chat completion request', async () => {
      const mockResponse = {
        id: 'chat-123',
        generation_details: {
          generations: [{ content: 'Hello there!', role: 'assistant' }],
        },
      };
      vi.mocked(request).mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: { json: vi.fn().mockResolvedValue(mockResponse) },
      } as unknown as Awaited<ReturnType<typeof request>>);

      const result = await client.generateChatCompletion(mockRequest);

      expect(request).toHaveBeenCalledWith(
        'https://api.salesforce.com/einstein/gpt/code/v1.1/chat/generations',
        {
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-jwt-token',
          }),
          body: JSON.stringify({
            ...mockRequest,
            system_prompt_strategy: 'use_model_parameter',
          }),
        },
      );
      expect(result.data).toEqual(mockResponse);
    });

    it('should include tools in request when provided', async () => {
      const requestWithTools = {
        ...mockRequest,
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get weather info',
              parameters: { type: 'object' },
            },
          },
        ],
      };

      vi.mocked(request).mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: { json: vi.fn().mockResolvedValue({}) },
      } as unknown as Awaited<ReturnType<typeof request>>);

      await client.generateChatCompletion(requestWithTools);

      expect(request).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            ...requestWithTools,
            system_prompt_strategy: 'use_model_parameter',
          }),
        }),
      );
    });
  });

  describe('generateChatCompletionStream', () => {
    const mockRequest = {
      model: 'test-model',
      messages: [{ role: 'user' as const, content: 'Hello!' }],
    };

    beforeEach(() => {
      (client as unknown as { jwt: typeof mockJWT })['jwt'] = mockJWT;
    });

    it('should handle successful chat stream request', async () => {
      const mockResponseData = {
        id: 'chat-123',
        generation_details: {
          generations: [{ content: 'Hello', role: 'assistant' }],
        },
      };
      const mockParser = {
        feed: vi.fn(),
      };
      const mockAsyncIterator = {
        [Symbol.asyncIterator]: () => ({
          next: vi
            .fn()
            .mockResolvedValueOnce({
              value: Buffer.from(
                'data: ' + JSON.stringify(mockResponseData) + '\n\n',
              ),
              done: false,
            })
            .mockResolvedValue({ done: true }),
        }),
      };

      vi.mocked(createParser).mockImplementation(({ onEvent }) => {
        mockParser.feed = vi.fn().mockImplementation((data) => {
          if (data.includes('data: ')) {
            const jsonData = data.replace('data: ', '').trim();
            onEvent?.({ event: 'data', data: jsonData });
          }
        });
        return mockParser as unknown as ReturnType<typeof createParser>;
      });

      vi.mocked(request).mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: mockAsyncIterator,
      } as unknown as Awaited<ReturnType<typeof request>>);

      const generator = await client.generateChatCompletionStream(mockRequest);
      const results = [];

      for await (const chunk of generator) {
        results.push(chunk);
      }

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(mockResponseData);
    });

    it('should add system_prompt_strategy to request', async () => {
      vi.mocked(request).mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: {
          [Symbol.asyncIterator]: () => ({
            next: vi.fn().mockResolvedValue({ done: true }),
          }),
        },
      } as unknown as Awaited<ReturnType<typeof request>>);

      await client.generateChatCompletionStream(mockRequest);

      expect(request).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            ...mockRequest,
            system_prompt_strategy: 'use_model_parameter',
          }),
        }),
      );
    });
  });

  describe('createEmbedding', () => {
    const mockRequest = {
      input: ['Hello, world!'],
      model: 'embedding-model',
    };

    beforeEach(() => {
      (client as unknown as { jwt: typeof mockJWT })['jwt'] = mockJWT;
    });

    it('should make successful embedding request', async () => {
      const mockResponse = {
        data: [{ embedding: [0.1, 0.2, 0.3], index: 0 }],
      };
      vi.mocked(request).mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: { json: vi.fn().mockResolvedValue(mockResponse) },
      } as unknown as Awaited<ReturnType<typeof request>>);

      const result = await client.createEmbedding(mockRequest);

      expect(request).toHaveBeenCalledWith(
        'https://api.salesforce.com/einstein/gpt/code/v1.1/embeddings',
        {
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-jwt-token',
          }),
          body: JSON.stringify(mockRequest),
        },
      );
      expect(result.data).toEqual(mockResponse);
    });
  });

  describe('submitFeedback', () => {
    const mockFeedback = {
      id: 'feedback-123',
      generation_id: 'gen-123',
      feedback: 'GOOD' as const,
      feedback_text: 'Great response!',
    };

    beforeEach(() => {
      (client as unknown as { jwt: typeof mockJWT })['jwt'] = mockJWT;
    });

    it('should make successful feedback request', async () => {
      const mockResponse = { success: true };
      vi.mocked(request).mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: { json: vi.fn().mockResolvedValue(mockResponse) },
      } as unknown as Awaited<ReturnType<typeof request>>);

      const result = await client.submitFeedback(mockFeedback);

      expect(request).toHaveBeenCalledWith(
        'https://api.salesforce.com/einstein/gpt/code/v1.1/feedback',
        {
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-jwt-token',
          }),
          body: JSON.stringify(mockFeedback),
        },
      );
      expect(result.data).toEqual(mockResponse);
    });
  });

  describe('getHeaders', () => {
    beforeEach(() => {
      (client as unknown as { jwt: typeof mockJWT })['jwt'] = mockJWT;
    });

    it('should generate correct headers for request type', () => {
      const headers = client['getHeaders']('test-model');

      expect(headers).toEqual({
        Authorization: 'Bearer mock-jwt-token',
        'Content-Type': 'application/json;charset=utf-8',
        'x-client-feature-id': 'EinsteinGptForDevelopers',
        'x-sfdc-app-context': 'EinsteinGPT',
        'x-sfdc-core-tenant-id': 'mock-tenant-id',
        'x-salesforce-region': 'EAST_REGION_1',
        'x-client-trace-id': expect.any(String),
        'x-custom': 'InternalTextGeneration',
      });
    });

    it('should generate correct headers for stream type', () => {
      const headers = client['getHeaders']('test-model');

      expect(headers).toEqual({
        Authorization: 'Bearer mock-jwt-token',
        'Content-Type': 'application/json;charset=utf-8',
        'x-client-feature-id': 'EinsteinGptForDevelopers',
        'x-sfdc-app-context': 'EinsteinGPT',
        'x-sfdc-core-tenant-id': 'mock-tenant-id',
        'x-salesforce-region': 'EAST_REGION_1',
        'x-client-trace-id': expect.any(String),
        'x-custom': 'InternalTextGeneration',
      });
    });

    it('should use default model when model not found', () => {
      // The default mock setup in beforeEach already handles this case
      const headers = client['getHeaders']('unknown-model');

      expect(models.getModelOrDefault).toHaveBeenCalledWith('unknown-model');
      expect(headers).toEqual(
        expect.objectContaining({
          'x-custom': 'InternalTextGeneration',
        }),
      );
    });

    it('should use found model when available', () => {
      const customModel = {
        description: 'Custom model',
        displayId: 'custom',
        model: 'custom-model',
        maxInputTokens: 8192,
        maxOutputTokens: 4096,
        customHeaders: { 'x-custom-model': 'InternalTextGeneration' },
        supportsMcp: true,
        extractUsage: defaultExtractUsage,
      };
      vi.mocked(models.getModelOrDefault).mockReturnValue(customModel);

      const headers = client['getHeaders']('custom-model');

      expect(headers).toEqual(
        expect.objectContaining({
          'x-custom-model': 'InternalTextGeneration',
        }),
      );
    });

    it('should throw error when JWT is not available', () => {
      (client as unknown as { jwt: undefined })['jwt'] = undefined;

      expect(() => client['getHeaders']('test-model')).toThrow('JWT not found');
    });
  });

  describe('shouldSkipEvent utility', () => {
    // Testing the utility function indirectly through stream behavior
    it('should skip score-related events during streaming', async () => {
      (client as unknown as { jwt: typeof mockJWT })['jwt'] = mockJWT;

      const mockParser = {
        feed: vi.fn(),
      };
      const mockAsyncIterator = {
        [Symbol.asyncIterator]: () => ({
          next: vi
            .fn()
            .mockResolvedValueOnce({
              value: Buffer.from('event: scoringStarted\ndata: {}\n\n'),
              done: false,
            })
            .mockResolvedValueOnce({
              value: Buffer.from('event: scoringCompleted\ndata: {}\n\n'),
              done: false,
            })
            .mockResolvedValueOnce({
              value: Buffer.from('event: scores\ndata: {}\n\n'),
              done: false,
            })
            .mockResolvedValue({ done: true }),
        }),
      };

      vi.mocked(createParser).mockImplementation(({ onEvent }) => {
        mockParser.feed = vi.fn().mockImplementation((data) => {
          if (data.includes('event: scoringStarted')) {
            onEvent?.({ event: 'scoringStarted', data: '{}' });
          }
          if (data.includes('event: scoringCompleted')) {
            onEvent?.({ event: 'scoringCompleted', data: '{}' });
          }
          if (data.includes('event: scores')) {
            onEvent?.({ event: 'scores', data: '{}' });
          }
        });
        return mockParser as unknown as ReturnType<typeof createParser>;
      });

      vi.mocked(request).mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: mockAsyncIterator,
      } as unknown as Awaited<ReturnType<typeof request>>);

      const generator = await client.generateCompletionStream({
        prompt: 'test',
        model: 'test-model',
      });

      const results = [];
      for await (const chunk of generator) {
        results.push(chunk);
      }

      expect(results).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      (client as unknown as { jwt: typeof mockJWT })['jwt'] = mockJWT;
    });

    it('should handle JSON parsing errors in stream gracefully', async () => {
      const mockParser = {
        feed: vi.fn(),
      };
      const consoleMock = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      const mockAsyncIterator = {
        [Symbol.asyncIterator]: () => ({
          next: vi
            .fn()
            .mockResolvedValueOnce({
              value: Buffer.from('data: invalid-json\n\n'),
              done: false,
            })
            .mockResolvedValue({ done: true }),
        }),
      };

      vi.mocked(createParser).mockImplementation(({ onEvent }) => {
        mockParser.feed = vi.fn().mockImplementation((data) => {
          if (data.includes('data: invalid-json')) {
            onEvent?.({ event: 'data', data: 'invalid-json' });
          }
        });
        return mockParser as unknown as ReturnType<typeof createParser>;
      });

      vi.mocked(request).mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: mockAsyncIterator,
      } as unknown as Awaited<ReturnType<typeof request>>);

      const generator = await client.generateCompletionStream({
        prompt: 'test',
        model: 'test-model',
      });

      const results = [];
      for await (const chunk of generator) {
        results.push(chunk);
      }

      expect(results).toHaveLength(0);
      expect(consoleMock).toHaveBeenCalledWith(
        "Failed to parse SSE JSON from data: 'invalid-json'",
        expect.any(Error),
      );

      consoleMock.mockRestore();
    });

    it('should handle missing response body in stream', async () => {
      vi.mocked(request).mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: null,
      } as unknown as Awaited<ReturnType<typeof request>>);

      const generator = await client.generateCompletionStream({
        prompt: 'test',
        model: 'test-model',
      });

      const results = [];
      for await (const chunk of generator) {
        results.push(chunk);
      }

      expect(results).toHaveLength(0);
    });
  });
});
