/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type ConversationKey = string;

export interface ThreadMessage {
  text: string;
  timestamp: string;
  userId: string; // Will be obfuscated before sending to API
}

export interface ConversationMapping {
  sessionId: string;
  workspaceRoot: string;
  threadMessages: ThreadMessage[];
  lastCodeyResponseTs?: string; // Track when Codey last responded
}

const store = new Map<ConversationKey, ConversationMapping>();

export function getKey(
  teamId: string,
  channelId: string,
  threadTs?: string,
): ConversationKey {
  // Always use threadTs if available, otherwise use channel as thread
  const thread = threadTs || channelId;
  return `${teamId}:${channelId}:${thread}`;
}

export function get(key: ConversationKey): ConversationMapping | undefined {
  return store.get(key);
}

export function set(key: ConversationKey, value: ConversationMapping): void {
  store.set(key, value);
}

export function remove(key: ConversationKey): void {
  store.delete(key);
}

export function addMessage(key: ConversationKey, message: ThreadMessage): void {
  const mapping = store.get(key);
  if (mapping) {
    mapping.threadMessages.push(message);
  }
}

export function updateLastCodeyResponse(
  key: ConversationKey,
  timestamp: string,
): void {
  const mapping = store.get(key);
  if (mapping) {
    mapping.lastCodeyResponseTs = timestamp;
  }
}

// Removed: markInitialized and isInitialized as initial instructions are no longer used
