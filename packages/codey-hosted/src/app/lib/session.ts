/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType, Config, GeminiClient } from '@google/gemini-cli-core';
import { initClient, sendMessage } from '@google/gemini-cli/headless-chat';

// In-memory session store for POC
type SessionId = string;
const sessions = new Map<
  SessionId,
  {
    config: Config;
    client: GeminiClient;
  }
>();

export function hasSession(sessionId: SessionId): boolean {
  return sessions.has(sessionId);
}

export async function sendMessageToSession(
  sessionId: SessionId,
  message: string,
) {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const response = await sendMessage(session.client, session.config, message);
  return response;
}

export async function createSession(workspaceRoot: string, model?: string) {
  const id = Math.random().toString(36).slice(2);
  const { client, config } = await initClient(
    workspaceRoot,
    id,
    AuthType.USE_SF_LLMG,
    { model },
  );
  sessions.set(id, { client, config });
  return { id };
}
