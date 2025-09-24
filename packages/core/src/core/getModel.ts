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

import {
  DEFAULT_GEMINI_EMBEDDING_MODEL,
  DEFAULT_GEMINI_FLASH_LITE_MODEL,
  DEFAULT_GEMINI_FLASH_MODEL,
  DEFAULT_GEMINI_MODEL,
} from '../config/models.js';
import {
  DEFAULT_GATEWAY_MODEL,
  DEFAULT_GATEWAY_FALLBACK_MODEL,
} from '../gateway/models.js';
import { AuthType } from './contentGenerator.js';

type ModelType =
  | 'default'
  | 'fallback'
  | 'embeddings'
  | 'search'
  | 'generateJson'
  | 'promptCompletion';

const GOOGLE_MODELS = {
  default: DEFAULT_GEMINI_MODEL,
  fallback: DEFAULT_GEMINI_FLASH_MODEL,
  embeddings: DEFAULT_GEMINI_EMBEDDING_MODEL,
  search: DEFAULT_GEMINI_FLASH_MODEL,
  generateJson: DEFAULT_GEMINI_FLASH_MODEL,
  promptCompletion: DEFAULT_GEMINI_FLASH_LITE_MODEL,
};

const MODELS = {
  [AuthType.USE_GEMINI]: GOOGLE_MODELS,
  [AuthType.USE_VERTEX_AI]: GOOGLE_MODELS,
  [AuthType.LOGIN_WITH_GOOGLE]: GOOGLE_MODELS,
  [AuthType.CLOUD_SHELL]: GOOGLE_MODELS,
  [AuthType.USE_SF_LLMG]: {
    default: DEFAULT_GATEWAY_MODEL.displayId,
    fallback: DEFAULT_GATEWAY_FALLBACK_MODEL.displayId,
    embeddings: DEFAULT_GATEWAY_MODEL.displayId,
    search: DEFAULT_GATEWAY_MODEL.displayId,
    generateJson: DEFAULT_GATEWAY_MODEL.displayId,
    promptCompletion: DEFAULT_GATEWAY_MODEL.displayId,
  },
};

export const AUTH_CACHE = new Map<'activeAuth', AuthType>();

function detectAuthTypeFromEnv(): AuthType | undefined {
  if (process.env['GOOGLE_GENAI_USE_GCA'] === 'true') {
    return AuthType.LOGIN_WITH_GOOGLE;
  }
  if (process.env['GOOGLE_GENAI_USE_VERTEXAI'] === 'true') {
    return AuthType.USE_VERTEX_AI;
  }
  if (process.env['CODEY_GATEWAY_ORG']) {
    return AuthType.USE_SF_LLMG;
  }
  if (process.env['GEMINI_API_KEY']) {
    return AuthType.USE_GEMINI;
  }
  return undefined;
}

/**
 * Retrieves a model string based on the specified model type and authentication type.
 *
 * @param type - The type of model to retrieve
 * @param authType - The authentication type used to determine the model mapping
 * @returns The model string corresponding to the given type and auth type
 * @throws {Error} When the provided auth type is not supported for model retrieval
 */
export const getModel = (type: ModelType, authType?: AuthType): string => {
  const effectiveAuthType =
    authType ??
    AUTH_CACHE.get('activeAuth') ??
    detectAuthTypeFromEnv() ??
    AuthType.USE_SF_LLMG;
  const modelMap = MODELS[effectiveAuthType];
  if (!modelMap) {
    throw new Error(
      `Unsupported auth type for model retrieval: ${effectiveAuthType}`,
    );
  }
  return modelMap[type];
};
