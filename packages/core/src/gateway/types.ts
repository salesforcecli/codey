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

export type GenerationRequest = {
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

export type ChatMessageRequest = {
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

export type EmbeddingRequest = {
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

export type CoreJwtResponse = { jwt: string };

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
      parameters?: {
        finish_reason?: string;
        [key: string]: unknown;
      };
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
