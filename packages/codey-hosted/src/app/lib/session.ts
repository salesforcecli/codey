/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType, Config, GeminiClient } from '@google/gemini-cli-core';
import {
  initClient,
  sendMessage,
  sendMessageStreaming,
} from '@google/gemini-cli/headless-chat';

// In-memory session store for POC
type SessionId = string;
const sessions = new Map<
  SessionId,
  {
    config: Config;
    client: GeminiClient;
    createdAt: number;
    lastUsed: number;
  }
>();

// Simple cleanup mechanism for POC - runs every 30 minutes
if (typeof window === 'undefined') {
  // Server-side only
  const CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 minutes
  const SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours

  setInterval(() => {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [id, session] of sessions.entries()) {
      if (now - session.lastUsed > SESSION_TIMEOUT) {
        sessions.delete(id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} inactive sessions`);
    }
  }, CLEANUP_INTERVAL);
}

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

  // Update last used timestamp
  session.lastUsed = Date.now();

  const response = await sendMessage(session.client, session.config, message);
  return response;
}

export async function sendMessageToSessionStreaming(
  sessionId: SessionId,
  message: string,
  onEvent: (event: unknown) => void,
) {
  const session = sessions.get(sessionId);
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

export async function createSession(workspaceRoot: string, model?: string) {
  const id = Math.random().toString(36).slice(2);
  const { client, config } = await initClient(
    workspaceRoot,
    id,
    AuthType.USE_GEMINI,
    { model },
  );

  const now = Date.now();
  sessions.set(id, {
    client,
    config,
    createdAt: now,
    lastUsed: now,
  });

  return { id };
}
