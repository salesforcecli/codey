/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { request } from 'undici';
import { JSONWebToken } from './jwt.js';
import {
  getSalesforceBaseUrl,
  getSalesforceRegionHeader,
  resolveSfApiEnv,
} from './env.js';
import { Org } from '@salesforce/core';
import { GatewayModel } from './models.js';
import { randomBytes } from 'crypto';
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

type ChatGenerationRequest = {
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
};

type ChatCompletionTool = {
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

    const username = process.env.SF_LLMG_USERNAME;
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
    const headers = this.getHeaders();
    // console.log('makeRequest body:', body);
    const response = await request(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const responseData = (await response.body.json()) as T;

    if (response.statusCode >= 400) {
      console.log('makeRequest error:', response.body.text());
      throw new Error(
        `Gateway API Error: ${response.statusCode} - ${(responseData as { message?: string })?.message || 'Request failed'}`,
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
    const headers = this.getHeaders();

    const response = await request(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    // console.log('makeStreamRequest body:', body);
    if (response.statusCode >= 400) {
      console.log('makeStreamRequest error:', response.body.text());
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
  private getHeaders(): Record<string, string> {
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
      ...(this.model.customHeaders || {}),
    };

    return headers;
  }
}
