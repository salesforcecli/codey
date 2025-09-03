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
  AuthType,
  type Config,
  type GeminiClient,
  type ServerGeminiStreamEvent,
} from '@google/gemini-cli-core';
import {
  initClient,
  sendMessage,
  sendMessageStreaming,
} from '@google/gemini-cli/headless-chat';

type SessionId = string;

const sessions = new Map<
  SessionId,
  { config: Config; client: GeminiClient; createdAt: number; lastUsed: number }
>();

// Background cleanup (server-only)
const CLEANUP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours

if (typeof globalThis !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, session] of sessions.entries()) {
      if (now - session.lastUsed > SESSION_TIMEOUT_MS) {
        sessions.delete(id);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} inactive sessions`);
    }
  }, CLEANUP_INTERVAL_MS).unref?.();
}

export async function createSession(workspaceRoot: string, model?: string) {
  const id = Math.random().toString(36).slice(2);
  const { client, config } = await initClient(
    workspaceRoot,
    id,
    AuthType.USE_GEMINI,
    { model },
  );
  const now = Date.now();
  sessions.set(id, { client, config, createdAt: now, lastUsed: now });
  return { id };
}

export function hasSession(id: string): boolean {
  return sessions.has(id);
}

export async function sendMessageToSession(
  id: string,
  message: string,
): Promise<{
  response: string;
  turnCount: number;
  events?: ServerGeminiStreamEvent[];
}> {
  const session = sessions.get(id);
  if (!session) {
    throw new Error('Session not found');
  }
  session.lastUsed = Date.now();
  return await sendMessage(session.client, session.config, message);
}

export async function sendMessageToSessionStreaming(
  id: string,
  message: string,
  onEvent: (e: ServerGeminiStreamEvent) => void,
): Promise<{ response: string; turnCount: number }> {
  const session = sessions.get(id);
  if (!session) {
    throw new Error('Session not found');
  }
  session.lastUsed = Date.now();
  return await sendMessageStreaming(
    session.client,
    session.config,
    message,
    onEvent,
  );
}
