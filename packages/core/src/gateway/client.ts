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

import { request } from 'undici';
import { JSONWebToken } from './jwt.js';
import {
  getSalesforceBaseUrl,
  getSalesforceRegionHeader,
  resolveSfApiEnv,
} from './env.js';
import { Org } from '@salesforce/core';
import { randomBytes } from 'node:crypto';
import { createParser } from 'eventsource-parser';
import { findGatewayModel, getModelOrDefault } from './models.js';
import type {
  CoreJwtResponse,
  GenerationRequest,
  GatewayResponse,
  Generations,
  ChatGenerations,
  ChatGenerationRequest,
  EmbeddingRequest,
} from './types.js';

type EndPoint =
  | '/generations'
  | '/generations/stream'
  | '/chat/generations'
  | '/chat/generations/stream'
  | '/embeddings'
  | '/feedback';

type RequestBody = {
  [key: string]: unknown;
  model?: string;
};

/**
 * Skip events that are not relevant to the user.
 */
function shouldSkipEvent(
  event: string | undefined,
  data: string | undefined,
): boolean {
  if (['scores', 'scoringStarted', 'scoringCompleted'].includes(event || '')) {
    return true;
  }
  if (!data) return true;
  return false;
}

/**
 * Simple API client for Salesforce LLM Gateway
 */
export class GatewayClient {
  private baseUrl: string;
  private regionHeader: string;
  private jwt: JSONWebToken | undefined;

  constructor() {
    const env = resolveSfApiEnv();
    this.regionHeader = getSalesforceRegionHeader(env);
    this.baseUrl = `${getSalesforceBaseUrl(env)}/einstein/gpt/code/v1.1`;
  }

  async maybeRequestJWT(): Promise<void> {
    if (this.jwt && !this.jwt.isExpired()) {
      return;
    }

    const username = process.env['CODEY_ORG_USERNAME'];
    if (!username) {
      throw new Error('CODEY_ORG_USERNAME is required for SF LLMG auth');
    }

    const org = await Org.create({ aliasOrUsername: username });
    const connection = org.getConnection();
    const url = `${connection.instanceUrl}/ide/auth`;

    const res = await connection.request<CoreJwtResponse>({
      method: 'POST',
      url,
      body: '{}',
    });

    if (!res?.jwt) {
      throw new Error('Failed to obtain JWT from /ide/auth');
    }

    this.jwt = new JSONWebToken({ jwt: res.jwt });
  }

  /**
   * Generate a response based on a prompt and model parameters
   */
  async generateCompletion(
    request: GenerationRequest,
  ): Promise<GatewayResponse<Generations>> {
    const modelConfig = findGatewayModel(request.model);
    if (modelConfig?.streamingOnly) {
      // For streaming-only models, use the streaming endpoint but accumulate the full response
      return this.makeRequestAsStream<Generations>(
        '/generations/stream',
        'POST',
        request,
      );
    }

    return this.makeRequest<Generations>('/generations', 'POST', request);
  }

  /**
   * Stream a generated response for the given prompt and parameters
   */
  async generateCompletionStream(
    request: GenerationRequest,
  ): Promise<AsyncGenerator<Generations>> {
    return this.makeStreamRequest<Generations>(
      '/generations/stream',
      'POST',
      request,
    );
  }

  /**
   * Generate a response from a list of role-annotated messages
   */
  async generateChatCompletion(
    request: ChatGenerationRequest,
  ): Promise<GatewayResponse<ChatGenerations>> {
    const modelConfig = findGatewayModel(request.model);
    if (modelConfig?.streamingOnly) {
      // For streaming-only models, use the streaming endpoint but accumulate the full response
      return this.makeRequestAsStream<ChatGenerations>(
        '/chat/generations/stream',
        'POST',
        {
          ...request,
          system_prompt_strategy: 'use_model_parameter',
        },
      );
    }

    return this.makeRequest<ChatGenerations>('/chat/generations', 'POST', {
      ...request,
      system_prompt_strategy: 'use_model_parameter',
    });
  }

  /**
   * Stream a generated response from role-annotated messages
   */
  async generateChatCompletionStream(
    request: ChatGenerationRequest,
  ): Promise<AsyncGenerator<ChatGenerations>> {
    return this.makeStreamRequest<ChatGenerations>(
      '/chat/generations/stream',
      'POST',
      {
        ...request,
        system_prompt_strategy: 'use_model_parameter',
      },
    );
  }

  /**
   * Create an embedding vector representing the input text
   */
  async createEmbedding(request: EmbeddingRequest): Promise<GatewayResponse> {
    return this.makeRequest('/embeddings', 'POST', request);
  }

  /**
   * Register feedback for a generation
   */
  async submitFeedback(feedback: {
    id: string;
    generation_id: string;
    feedback?: 'GOOD' | 'BAD' | null;
    feedback_text?: string;
    source?: string;
    app_feedback?: Record<string, unknown>;
    app_generation_id?: string;
    app_generation?: string;
    turn_id?: string;
  }): Promise<GatewayResponse> {
    return this.makeRequest('/feedback', 'POST', feedback);
  }

  /**
   * Make a standard HTTP request to the LLMG API
   */
  private async makeRequest<T>(
    endpoint: EndPoint,
    method: string,
    body?: RequestBody,
  ): Promise<GatewayResponse<T>> {
    await this.maybeRequestJWT();
    const url = `${this.baseUrl}${endpoint}`;
    const headers = this.getHeaders(body?.model);
    const response = await request(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const responseData = (await response.body.json()) as T;

    if (response.statusCode >= 400) {
      throw new Error(
        `Gateway API Error: ${response.statusCode} - ${(responseData as { message?: string })?.message || 'Request failed'}.`,
      );
    }

    return {
      data: responseData,
      status: response.statusCode,
      headers: response.headers as Record<string, string>,
    };
  }

  /**
   * Make a streaming HTTP request to the LLMG API
   */
  private async makeStreamRequest<T>(
    endpoint: EndPoint,
    method: string,
    body?: RequestBody,
  ): Promise<AsyncGenerator<T>> {
    await this.maybeRequestJWT();
    const url = `${this.baseUrl}${endpoint}`;
    const headers = this.getHeaders(body?.model);

    const response = await request(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.statusCode >= 400) {
      const errorData = await response.body.json();
      const errorMessage =
        (errorData as { message?: string })?.message || 'Request failed';
      throw new Error(
        `Gateway API Error: ${response.statusCode} - ${errorMessage}: ${JSON.stringify(errorData)}`,
      );
    }

    return (async function* (): AsyncGenerator<T> {
      if (!response.body) {
        return;
      }
      const decoder = new TextDecoder();
      const queue: T[] = [];

      // Create the parser
      const parser = createParser({
        onEvent: ({ event, data }) => {
          if (!data) return;
          if (shouldSkipEvent(event, data)) return;
          const trimmed = data.trim();
          // Treat provider DONE sentinel as a terminal JSON chunk so downstream can finalize cleanly
          if (trimmed === '[DONE]' || trimmed === 'DONE') {
            try {
              const terminalChunk =
                endpoint === '/chat/generations/stream'
                  ? ({
                      id: 'terminal',
                      generation_details: {
                        generations: [
                          {
                            role: 'assistant',
                            content: '',
                            parameters: { finish_reason: 'stop' },
                          },
                        ],
                        parameters: {},
                      },
                    } as unknown as T)
                  : ({ id: 'terminal', generations: [] } as unknown as T);
              queue.push(terminalChunk);
            } catch (e) {
              console.warn(
                `Failed to synthesize terminal chunk from DONE sentinel`,
                e,
              );
            }
            return;
          }
          try {
            queue.push(JSON.parse(data));
          } catch (e) {
            console.warn(`Failed to parse SSE JSON from data: '${data}'`, e);
          }
        },
      });

      for await (const chunk of response.body) {
        parser.feed(decoder.decode(chunk, { stream: true }));

        while (queue.length > 0) {
          const item = queue.shift();
          if (item !== undefined) {
            yield item;
          }
        }
      }
    })();
  }

  /**
   * Get the required headers for LLMG API requests
   */
  private getHeaders(modelName: string | undefined): Record<string, string> {
    if (!this.jwt) {
      throw new Error('JWT not found');
    }

    const model = getModelOrDefault(modelName);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.jwt.value()}`,
      'Content-Type': 'application/json;charset=utf-8',
      'x-client-feature-id': 'EinsteinGptForDevelopers',
      'x-sfdc-app-context': 'EinsteinGPT',
      'x-sfdc-core-tenant-id': this.jwt.tnk(),
      'x-salesforce-region': this.regionHeader,
      'x-client-trace-id': randomBytes(8).toString('hex'),
      ...(model.customHeaders || {}),
    };

    return headers;
  }

  /**
   * Makes a streaming request to the specified endpoint and accumulates all chunks into a single response.
   *
   * @template T - The type of chat generations response, must extend ChatGenerations
   * @param endpoint - The API endpoint to make the request to
   * @param method - The HTTP method to use for the request
   * @param body - Optional request body to send with the request
   * @returns A promise that resolves to a GatewayResponse containing the accumulated stream data
   * @throws {Error} When no data is received from the stream
   *
   * @remarks
   * This method consumes the entire stream by iterating through all chunks and merging them
   * using the `mergeStreamChunks` method. The first chunk initializes the accumulated response,
   * and subsequent chunks are merged into it.
   */
  private async makeRequestAsStream<T extends ChatGenerations>(
    endpoint: EndPoint,
    method: string,
    body?: RequestBody,
  ): Promise<GatewayResponse<T>> {
    const streamGenerator = await this.makeStreamRequest<T>(
      endpoint,
      method,
      body,
    );

    let accumulatedResponse: T | null = null;
    const lastStatusCode = 200;
    const lastHeaders: Record<string, string> = {};

    // Consume the entire stream
    for await (const chunk of streamGenerator) {
      if (!accumulatedResponse) {
        // Initialize with the first chunk
        accumulatedResponse = { ...chunk };
      } else {
        // Merge subsequent chunks
        accumulatedResponse = this.mergeStreamChunks(
          accumulatedResponse,
          chunk,
        );
      }
    }

    if (!accumulatedResponse) {
      throw new Error('No data received from stream');
    }

    return {
      data: accumulatedResponse,
      status: lastStatusCode,
      headers: lastHeaders,
    };
  }

  /**
   * Merge streaming chunks into a single accumulated response
   */
  private mergeStreamChunks<T extends ChatGenerations>(
    accumulated: T,
    chunk: T,
  ): T {
    const merged = { ...accumulated };

    // Merge generation details
    if (chunk.generation_details?.generations) {
      if (!merged.generation_details) {
        merged.generation_details = { generations: [] };
      }
      if (!merged.generation_details.generations) {
        merged.generation_details.generations = [];
      }

      // For each generation in the chunk
      chunk.generation_details.generations.forEach((chunkGen, index) => {
        if (!merged.generation_details!.generations[index]) {
          // First time seeing this generation index, initialize it
          merged.generation_details!.generations[index] = {
            content: '',
            role: chunkGen.role,
            parameters: { ...chunkGen.parameters },
            tool_invocations: chunkGen.tool_invocations
              ? [...chunkGen.tool_invocations]
              : undefined,
          };
        }

        const existingGen = merged.generation_details!.generations[index];

        // Accumulate content
        if (chunkGen.content) {
          existingGen.content += chunkGen.content;
        }

        // Update parameters (later chunks may have finish_reason, usage info, etc.)
        if (chunkGen.parameters) {
          existingGen.parameters = {
            ...existingGen.parameters,
            ...chunkGen.parameters,
          };
        }

        // Merge tool invocations
        if (chunkGen.tool_invocations) {
          if (!existingGen.tool_invocations) {
            existingGen.tool_invocations = [];
          }

          chunkGen.tool_invocations.forEach((chunkTool) => {
            const existingTool = existingGen.tool_invocations!.find(
              (t) => t.id === chunkTool.id,
            );
            if (existingTool) {
              // Accumulate arguments for streaming tool calls
              existingTool.function.arguments += chunkTool.function.arguments;
            } else {
              // New tool invocation
              existingGen.tool_invocations!.push({ ...chunkTool });
            }
          });
        }
      });
    }

    // Update top-level parameters (usage info, etc.)
    if (chunk.generation_details?.parameters) {
      if (!merged.generation_details!.parameters) {
        merged.generation_details!.parameters = {};
      }
      merged.generation_details!.parameters = {
        ...merged.generation_details!.parameters,
        ...chunk.generation_details.parameters,
      };
    }

    return merged;
  }
}
