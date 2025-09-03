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

import type { ContentGenerator } from '../core/contentGenerator.js';
import { AuthType } from '../core/contentGenerator.js';
import { getOauthClient } from './oauth2.js';
import { setupUser } from './setup.js';
import type { HttpOptions } from './server.js';
import { CodeAssistServer } from './server.js';
import type { Config } from '../config/config.js';
import { LoggingContentGenerator } from '../core/loggingContentGenerator.js';

export async function createCodeAssistContentGenerator(
  httpOptions: HttpOptions,
  authType: AuthType,
  config: Config,
  sessionId?: string,
): Promise<ContentGenerator> {
  if (
    authType === AuthType.LOGIN_WITH_GOOGLE ||
    authType === AuthType.CLOUD_SHELL
  ) {
    const authClient = await getOauthClient(authType, config);
    const userData = await setupUser(authClient);
    return new CodeAssistServer(
      authClient,
      userData.projectId,
      httpOptions,
      sessionId,
      userData.userTier,
    );
  }

  if (authType === AuthType.USE_SF_LLMG) {
    // For SF LLMG, we still reuse CodeAssistServer surface to keep the
    // rest of the app unchanged. Internals are handled by a different
    // content generator implementation created by createContentGenerator.
    // This branch should not be reached because createContentGenerator
    // short-circuits for USE_SF_LLMG earlier, but we keep it explicit
    // for clarity and future refactors.
    throw new Error('Internal setup for SF LLMG should be handled upstream.');
  }

  throw new Error(`Unsupported authType: ${authType}`);
}

export function getCodeAssistServer(
  config: Config,
): CodeAssistServer | undefined {
  let server = config.getGeminiClient().getContentGenerator();

  // Unwrap LoggingContentGenerator if present
  if (server instanceof LoggingContentGenerator) {
    server = server.getWrapped();
  }

  if (!(server instanceof CodeAssistServer)) {
    return undefined;
  }
  return server;
}
