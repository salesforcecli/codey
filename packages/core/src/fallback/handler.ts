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

import type { Config } from '../config/config.js';
import { AuthType } from '../core/contentGenerator.js';
import { logFlashFallback, FlashFallbackEvent } from '../telemetry/index.js';
import { getModel } from '../core/getModel.js';

export async function handleFallback(
  config: Config,
  failedModel: string,
  authType?: string,
  error?: unknown,
): Promise<string | boolean | null> {
  // Applicability Checks
  if (authType !== AuthType.LOGIN_WITH_GOOGLE) return null;

  const fallbackModel = getModel('fallback', authType);

  if (failedModel === fallbackModel) return null;

  // Consult UI Handler for Intent
  const fallbackModelHandler = config.fallbackModelHandler;
  if (typeof fallbackModelHandler !== 'function') return null;

  try {
    // Pass the specific failed model to the UI handler.
    const intent = await fallbackModelHandler(
      failedModel,
      fallbackModel,
      error,
    );

    // Process Intent and Update State
    switch (intent) {
      case 'retry':
        // Activate fallback mode. The NEXT retry attempt will pick this up.
        activateFallbackMode(config, authType);
        return true; // Signal retryWithBackoff to continue.

      case 'stop':
        activateFallbackMode(config, authType);
        return false;

      case 'auth':
        return false;

      default:
        throw new Error(
          `Unexpected fallback intent received from fallbackModelHandler: "${intent}"`,
        );
    }
  } catch (handlerError) {
    console.error('Fallback UI handler failed:', handlerError);
    return null;
  }
}

function activateFallbackMode(config: Config, authType: string | undefined) {
  if (!config.isInFallbackMode()) {
    config.setFallbackMode(true);
    if (authType) {
      logFlashFallback(config, new FlashFallbackEvent(authType));
    }
  }
}
