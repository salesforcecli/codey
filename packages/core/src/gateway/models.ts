/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type GatewayModel = {
  description: string;
  displayId: string;
  model: string;
  isInsideTrustBoundary: boolean;
  supportsStreaming: boolean;
  supportsMcp: boolean;
  supportsPromptCache: boolean;
  supportsImages: boolean;
  maxInputTokens: number;
  maxOutputTokens: number;
  permittedParameters: string[];
  customRequestHeaders?: Record<string, string>;
  customStreamHeaders?: Record<string, string>;
};

export const QWEN = {
  description: 'Salesforce Qwen',
  displayId: 'SFR Model',
  model: 'xgen_stream',
  isInsideTrustBoundary: true,
  supportsStreaming: true,
  supportsMcp: false,
  supportsPromptCache: false,
  supportsImages: false,
  maxInputTokens: 32768,
  maxOutputTokens: 2048,
  permittedParameters: ['command_source', 'guided_json', 'user_prompt'],
  customStreamHeaders: {
    'x-llm-provider': 'InternalTextGeneration',
  },
};

export const Claude37Sonnet = {
  description: 'Claude 3.7 Sonnet',
  displayId: 'Claude 3.7 Sonnet',
  model: 'llmgateway__BedrockAnthropicClaude37Sonnet',
  isInsideTrustBoundary: true,
  supportsStreaming: true,
  supportsMcp: true,
  supportsPromptCache: false,
  supportsImages: false,
  maxInputTokens: 8192, // https://git.soma.salesforce.com/pages/tech-enablement/einstein/docs/gateway/models-and-providers/#comparison-table
  maxOutputTokens: 8192,
  permittedParameters: ['command_source', 'guided_json'], // it can get successful responses but seemingly not makes a difference
};

export const Claude4Sonnet = {
  description: 'Claude 4 Sonnet',
  displayId: 'Claude 4 Sonnet',
  model: 'llmgateway__BedrockAnthropicClaude4Sonnet',
  isInsideTrustBoundary: true,
  supportsStreaming: true,
  supportsMcp: true,
  supportsPromptCache: false,
  supportsImages: false,
  maxInputTokens: 8192, // https://git.soma.salesforce.com/pages/tech-enablement/einstein/docs/gateway/models-and-providers/#comparison-table
  maxOutputTokens: 8192,
  permittedParameters: ['command_source', 'guided_json'], // it can get successful responses but seemingly not makes a difference
};

export const GPT4oMini = {
  description: 'ChatGPT 4o Mini',
  displayId: 'GPT-4o Mini',
  model: 'llmgateway__OpenAIGPT4OmniMini',
  isInsideTrustBoundary: false,
  supportsStreaming: true,
  supportsMcp: true,
  supportsPromptCache: false,
  supportsImages: false,
  maxInputTokens: 128000, // refer to https://git.soma.salesforce.com/pages/tech-enablement/einstein/docs/gateway/models-and-providers/#comparison-table
  maxOutputTokens: 16384,
  permittedParameters: [],
};
