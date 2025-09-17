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

import type { ChatGenerations } from './types.js';

export type GatewayModel = {
  customHeaders?: Record<string, string>;
  description: string;
  displayId: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  model: string;
  streamToolCalls?: boolean;
  streamingOnly?: boolean;
  supportsStructuredOutput?: boolean;
  supportsMcp: boolean;
  // Optional content transformer to clean up model-specific artifacts
  transformContent?: (content: string, isFirstChunk: boolean) => string;
  extractUsage: (
    data: ChatGenerations,
  ) =>
    | { inputTokens?: number; outputTokens?: number; totalTokens?: number }
    | undefined;
};

export function defaultExtractUsage(
  data: ChatGenerations,
):
  | { inputTokens?: number; outputTokens?: number; totalTokens?: number }
  | undefined {
  const usage = data.generation_details?.parameters?.usage;
  if (usage) {
    return {
      inputTokens: usage['inputTokens'],
      outputTokens: usage['outputTokens'],
      totalTokens: usage['totalTokens'],
    };
  }
  return undefined;
}

export const QWEN: GatewayModel = {
  description: 'Salesforce Qwen',
  displayId: 'SFR Model',
  model: 'xgen_stream',
  maxInputTokens: 30720,
  maxOutputTokens: 2048,
  streamToolCalls: true,
  // It's not documented but xgen_stream only supports the streaming endpoints
  streamingOnly: true,
  customHeaders: {
    'x-llm-provider': 'InternalTextGeneration',
  },
  supportsMcp: false,
  extractUsage: (data: ChatGenerations) => {
    const usage = data.generation_details?.generations[0]?.parameters;
    if (usage) {
      return {
        inputTokens: usage['prompt_tokens'] as number,
        outputTokens: usage['generated_tokens'] as number,
        totalTokens:
          (usage['prompt_tokens'] as number) +
          (usage['generated_tokens'] as number),
      };
    }
    return;
  },
  // Simple transformer to clean up QWen's odd prefixes
  transformContent: (content: string, isFirstChunk: boolean) => {
    if (!isFirstChunk || !content.trim()) {
      return content;
    }

    return (
      content
        // Remove patterns like "?\n:" at the start
        .replace(/^[?!@#$%^&*()_+\-=[\]{}|;':",./<>?`~]*\n+[:;]*/, '')
        // Remove "assistant:" prefix
        .replace(/^assistant:\s*/i, '')
    );
  },
};

export const Claude37Sonnet: GatewayModel = {
  description: 'Claude 3.7 Sonnet',
  displayId: 'Claude 3.7 Sonnet',
  model: 'llmgateway__BedrockAnthropicClaude37Sonnet',
  maxInputTokens: 8192, // https://git.soma.salesforce.com/pages/tech-enablement/einstein/docs/gateway/models-and-providers/#comparison-table
  maxOutputTokens: 8192,
  supportsMcp: true,
  extractUsage: defaultExtractUsage,
};

export const Claude4Sonnet: GatewayModel = {
  description: 'Claude 4 Sonnet',
  displayId: 'Claude 4 Sonnet',
  model: 'llmgateway__BedrockAnthropicClaude4Sonnet',
  maxInputTokens: 8192, // https://git.soma.salesforce.com/pages/tech-enablement/einstein/docs/gateway/models-and-providers/#comparison-table
  maxOutputTokens: 8192,
  supportsMcp: true,
  extractUsage: defaultExtractUsage,
};

export const GPT4oMini: GatewayModel = {
  description: 'ChatGPT 4o Mini',
  displayId: 'GPT-4o Mini',
  model: 'llmgateway__OpenAIGPT4OmniMini',
  maxInputTokens: 128000, // refer to https://git.soma.salesforce.com/pages/tech-enablement/einstein/docs/gateway/models-and-providers/#comparison-table
  maxOutputTokens: 16384,
  streamToolCalls: true,
  supportsStructuredOutput: true,
  supportsMcp: true,
  extractUsage: (data: ChatGenerations) => {
    const usage = data.generation_details?.parameters?.usage;
    if (usage) {
      return {
        inputTokens: usage['prompt_tokens'],
        outputTokens: usage['completion_tokens'],
        totalTokens: usage['total_tokens'],
      };
    }
    return;
  },
};

export const Gemini25FlashLite: GatewayModel = {
  description: 'Gemini 2.5 Flash Lite',
  displayId: 'Gemini 2.5 Flash Lite',
  model: 'llmgateway__VertexAIGemini25FlashLite001',
  supportsMcp: true,
  maxInputTokens: 1048576, // refer to https://git.soma.salesforce.com/pages/tech-enablement/einstein/docs/gateway/models-and-providers/#comparison-table
  maxOutputTokens: 65535,
  extractUsage: (data: ChatGenerations) => {
    const usage = data.generation_details?.parameters?.usage;
    if (usage) {
      return {
        inputTokens: usage['inputTokenCount'],
        outputTokens: usage['outputTokenCount'],
        totalTokens: usage['totalTokenCount'],
      };
    }
    return;
  },
};

const getModelFromEnv = (envVar: string): GatewayModel | undefined => {
  const model = process.env[envVar];
  if (model) return findGatewayModel(model);
  return;
};

export const DEFAULT_GATEWAY_MODEL =
  getModelFromEnv('CODEY_DEFAULT_MODEL') ?? Gemini25FlashLite;
export const DEFAULT_GATEWAY_FALLBACK_MODEL =
  getModelFromEnv('CODEY_DEFAULT_FALLBACK_MODEL') ?? QWEN;

const GATEWAY_MODELS: GatewayModel[] = [
  QWEN,
  Claude37Sonnet,
  Claude4Sonnet,
  GPT4oMini,
  Gemini25FlashLite,
];

/**
 * Finds a gateway model by its name or display ID.
 *
 * @param nameOrId - The model name or display ID to search for (case-insensitive)
 * @returns The matching GatewayModel if found, undefined otherwise
 */
export function findGatewayModel(nameOrId: string): GatewayModel | undefined {
  const needle = (nameOrId || '').toLowerCase();
  return GATEWAY_MODELS.find(
    (m) =>
      m.model.toLowerCase() === needle || m.displayId.toLowerCase() === needle,
  );
}

/**
 * Retrieves a gateway model by name or ID, returning the default model if not found or if no identifier is provided.
 *
 * @param nameOrId - The name or ID of the gateway model to retrieve. If undefined, the default model is returned.
 * @returns The found gateway model or the default gateway model if not found or if nameOrId is undefined.
 */
export function getModelOrDefault(nameOrId: string | undefined): GatewayModel {
  return nameOrId
    ? findGatewayModel(nameOrId) || DEFAULT_GATEWAY_MODEL
    : DEFAULT_GATEWAY_MODEL;
}
