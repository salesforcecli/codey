/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType, ContentGenerator } from '../core/contentGenerator.js';
import { getOauthClient } from './oauth2.js';
import { setupUser } from './setup.js';
import { CodeAssistServer, HttpOptions } from './server.js';
import { Config } from '../config/config.js';

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
