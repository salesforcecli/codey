/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type ConversationKey = string;

export interface ConversationMapping {
  sessionId: string;
  workspaceRoot: string;
}

const store = new Map<ConversationKey, ConversationMapping>();

export function getKey(
  teamId: string,
  channelId: string,
  threadTs?: string,
): ConversationKey {
  return `${teamId}:${channelId}:${threadTs ?? ''}`;
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
