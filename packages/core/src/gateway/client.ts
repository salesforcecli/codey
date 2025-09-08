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
import { type GatewayModel } from './models.js';
import { randomBytes } from 'node:crypto';
import { createParser } from 'eventsource-parser';

type Options = {
  model: GatewayModel;
};

type GenerationRequest = {
  prompt: string;
  model: string;
  num_generations?: number;
  max_tokens?: number;
  temperature?: number;
  stop_sequences?: string[];
  frequency_penalty?: number;
  presence_penalty?: number;
  enable_pii_masking?: boolean;
  enable_input_safety_scoring?: boolean;
  enable_output_safety_scoring?: boolean;
  enable_input_bias_scoring?: boolean;
  enable_output_bias_scoring?: boolean;
  parameters?: Record<string, unknown>;
};

type ChatMessageRequest = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

type MessageContent = {
  type: string;
  text?: string;
  url?: string;
};

type GenerationSettings = {
  max_tokens?: number;
  temperature?: number;
  stop_sequences?: string[];
  frequency_penalty?: number;
  presence_penalty?: number;
  top_p?: number;
  top_k?: number;
  seed?: number;
};

export type ChatGenerationRequest = {
  model: string;
  messages: ChatMessageRequest[];
  generation_settings?: GenerationSettings;
  enable_pii_masking?: boolean;
  enable_input_safety_scoring?: boolean;
  enable_output_safety_scoring?: boolean;
  enable_input_bias_scoring?: boolean;
  enable_output_bias_scoring?: boolean;
  turn_id?: string;
  system_prompt_strategy?: string;
  tools?: ChatCompletionTool[];
  tool_config?: {
    mode: 'auto' | 'none' | 'tool' | 'any';
    allowed_tools?: Array<{
      type: string;
      name: string;
    }>;
    parallel_calls?: boolean;
  };
};

export type ChatCompletionTool = {
  type: string;
  function?: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
  web_search?: {
    provider: string;
    options: Record<string, unknown>;
  };
};

type EmbeddingRequest = {
  input: string[];
  model?: string;
  enable_pii_masking?: boolean;
  parameters?: Record<string, unknown>;
};

export type GatewayResponse<T = unknown> = {
  data: T;
  status: number;
  headers: Record<string, string>;
};

type CoreJwtResponse = { jwt: string };

export type Generations = {
  id: string;
  generations: Array<{
    text: string;
  }>;
};

export type ChatGenerations = {
  id: string;
  generation_details?: {
    generations: Array<{
      content: string;
      role: string;
      tool_invocations?: Array<{
        id: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    }>;
    parameters?: {
      usage?: {
        [key: string]: number;
      };
    };
  };
};

type EndPoint =
  | '/generations'
  | '/generations/stream'
  | '/chat/generations'
  | '/chat/generations/stream'
  | '/embeddings'
  | '/feedback';

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
  const trimmedData = data.trim();
  if (trimmedData === '[DONE]' || trimmedData === 'DONE') {
    return true;
  }
  return false;
}

/**
 * Simple API client for Salesforce LLM Gateway
 */
export class GatewayClient {
  private baseUrl: string;
  private regionHeader: string;
  private jwt: JSONWebToken | undefined;
  private model: GatewayModel;

  constructor(options: Options) {
    const env = resolveSfApiEnv();
    this.regionHeader = getSalesforceRegionHeader(env);
    this.baseUrl = `${getSalesforceBaseUrl(env)}/einstein/gpt/code/v1.1`;
    this.model = options.model;
  }

  async maybeRequestJWT(): Promise<void> {
    if (this.jwt && !this.jwt.isExpired()) {
      return;
    }

    const username = process.env['SF_LLMG_USERNAME'];
    if (!username) {
      throw new Error('SF_LLMG_USERNAME is required for SF LLMG auth');
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
    body?: unknown,
  ): Promise<GatewayResponse<T>> {
    await this.maybeRequestJWT();
    const url = `${this.baseUrl}${endpoint}`;
    const headers = this.getHeaders('request');
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
    body?: unknown,
  ): Promise<AsyncGenerator<T>> {
    await this.maybeRequestJWT();
    const url = `${this.baseUrl}${endpoint}`;
    const headers = this.getHeaders('stream');

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
          if (shouldSkipEvent(event, data)) return;

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
  private getHeaders(type: 'request' | 'stream'): Record<string, string> {
    if (!this.jwt) {
      throw new Error('JWT not found');
    }
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.jwt.value()}`,
      'Content-Type': 'application/json;charset=utf-8',
      'x-client-feature-id': 'EinsteinGptForDevelopers',
      'x-sfdc-app-context': 'EinsteinGPT',
      'x-sfdc-core-tenant-id': this.jwt.tnk(),
      'x-salesforce-region': this.regionHeader,
      'x-client-trace-id': randomBytes(8).toString('hex'),
      ...(type === 'request' ? this.model.customRequestHeaders || {} : {}),
      ...(type === 'stream' ? this.model.customStreamHeaders || {} : {}),
    };

    return headers;
  }
}
