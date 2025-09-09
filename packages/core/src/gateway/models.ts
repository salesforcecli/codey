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

export type GatewayModel = {
  description: string;
  displayId: string;
  model: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  permittedParameters: string[];
  customRequestHeaders?: Record<string, string>;
  customStreamHeaders?: Record<string, string>;
  streamToolCalls?: boolean;
  supportsStructuredOutput?: boolean;
  usageParameters: {
    inputTokens: string; // e.g., 'inputTokens' or 'promptTokens'
    outputTokens: string; // e.g., 'outputTokens' or 'completionTokens'
    totalTokens: string; // e.g., 'totalTokens'
  };
};

export const QWEN: GatewayModel = {
  description: 'Salesforce Qwen',
  displayId: 'SFR Model',
  model: 'xgen_stream',
  maxInputTokens: 30720,
  maxOutputTokens: 2048,
  permittedParameters: ['command_source', 'guided_json', 'user_prompt'],
  customStreamHeaders: {
    'x-llm-provider': 'InternalTextGeneration',
  },
  usageParameters: {
    inputTokens: 'inputTokens',
    outputTokens: 'outputTokens',
    totalTokens: 'totalTokens',
  },
};

export const Claude37Sonnet: GatewayModel = {
  description: 'Claude 3.7 Sonnet',
  displayId: 'Claude 3.7 Sonnet',
  model: 'llmgateway__BedrockAnthropicClaude37Sonnet',
  maxInputTokens: 8192, // https://git.soma.salesforce.com/pages/tech-enablement/einstein/docs/gateway/models-and-providers/#comparison-table
  maxOutputTokens: 8192,
  permittedParameters: ['command_source', 'guided_json'], // it can get successful responses but seemingly not makes a difference
  usageParameters: {
    inputTokens: 'inputTokens',
    outputTokens: 'outputTokens',
    totalTokens: 'totalTokens',
  },
};

export const Claude4Sonnet: GatewayModel = {
  description: 'Claude 4 Sonnet',
  displayId: 'Claude 4 Sonnet',
  model: 'llmgateway__BedrockAnthropicClaude4Sonnet',
  maxInputTokens: 8192, // https://git.soma.salesforce.com/pages/tech-enablement/einstein/docs/gateway/models-and-providers/#comparison-table
  maxOutputTokens: 8192,
  permittedParameters: ['command_source', 'guided_json'], // it can get successful responses but seemingly not makes a difference
  usageParameters: {
    inputTokens: 'inputTokens',
    outputTokens: 'outputTokens',
    totalTokens: 'totalTokens',
  },
};

export const GPT4oMini: GatewayModel = {
  description: 'ChatGPT 4o Mini',
  displayId: 'GPT-4o Mini',
  model: 'llmgateway__OpenAIGPT4OmniMini',
  maxInputTokens: 128000, // refer to https://git.soma.salesforce.com/pages/tech-enablement/einstein/docs/gateway/models-and-providers/#comparison-table
  maxOutputTokens: 16384,
  permittedParameters: [],
  streamToolCalls: true,
  supportsStructuredOutput: true,
  usageParameters: {
    inputTokens: 'prompt_tokens',
    outputTokens: 'completion_tokens',
    totalTokens: 'total_tokens',
  },
};

export const DEFAULT_GATEWAY_MODEL = GPT4oMini;
export const DEFAULT_GATEWAY_FALLBACK_MODEL = QWEN;

const GATEWAY_MODELS: GatewayModel[] = [
  QWEN,
  Claude37Sonnet,
  Claude4Sonnet,
  GPT4oMini,
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
