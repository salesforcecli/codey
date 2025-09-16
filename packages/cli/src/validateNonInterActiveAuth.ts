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

import type { Config } from '@salesforce/codey-core';
import { AuthType, OutputFormat } from '@salesforce/codey-core';
import { USER_SETTINGS_PATH } from './config/settings.js';
import { validateAuthMethod } from './config/auth.js';
import { type LoadedSettings } from './config/settings.js';
import { handleError } from './utils/errors.js';

function getAuthTypeFromEnv(): AuthType | undefined {
  if (process.env['GOOGLE_GENAI_USE_GCA'] === 'true') {
    return AuthType.LOGIN_WITH_GOOGLE;
  }
  if (process.env['GOOGLE_GENAI_USE_VERTEXAI'] === 'true') {
    return AuthType.USE_VERTEX_AI;
  }
  if (process.env['CODEY_ORG_USERNAME']) {
    return AuthType.USE_SF_LLMG;
  }
  if (process.env['GEMINI_API_KEY']) {
    return AuthType.USE_GEMINI;
  }
  return undefined;
}

export async function validateNonInteractiveAuth(
  configuredAuthType: AuthType | undefined,
  useExternalAuth: boolean | undefined,
  nonInteractiveConfig: Config,
  settings: LoadedSettings,
) {
  try {
    const enforcedType = settings.merged.security?.auth?.enforcedType;
    if (enforcedType) {
      const currentAuthType = getAuthTypeFromEnv();
      if (currentAuthType !== enforcedType) {
        const message = `The configured auth type is ${enforcedType}, but the current auth type is ${currentAuthType}. Please re-authenticate with the correct type.`;
        throw new Error(message);
      }
    }

    const effectiveAuthType =
      enforcedType || getAuthTypeFromEnv() || configuredAuthType;

    if (!effectiveAuthType) {
      const message = `Please set an Auth method in your ${USER_SETTINGS_PATH} or specify one of the following environment variables before running: GEMINI_API_KEY, GOOGLE_GENAI_USE_VERTEXAI, GOOGLE_GENAI_USE_GCA`;
      throw new Error(message);
    }

    const authType: AuthType = effectiveAuthType as AuthType;

    if (!useExternalAuth) {
      const err = validateAuthMethod(String(authType));
      if (err != null) {
        throw new Error(err);
      }
    }

    await nonInteractiveConfig.refreshAuth(authType);
    return nonInteractiveConfig;
  } catch (error) {
    if (nonInteractiveConfig.getOutputFormat() === OutputFormat.JSON) {
      handleError(
        error instanceof Error ? error : new Error(String(error)),
        nonInteractiveConfig,
        1,
      );
    } else {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }
}
