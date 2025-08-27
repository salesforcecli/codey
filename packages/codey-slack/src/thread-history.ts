/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ThreadMessage } from './session-store';

export interface SlackMessage {
  text: string;
  ts: string;
  user: string;
  type: string;
}

export function obfuscateUserId(userId: string): string {
  // Create a simple hash-like obfuscation that's consistent per user
  // but doesn't reveal the actual user ID
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `User${Math.abs(hash) % 1000}`;
}

export function formatThreadHistoryForAPI(messages: ThreadMessage[]): string {
  if (messages.length === 0) {
    return 'THREAD HISTORY UPDATE: []';
  }

  const formattedMessages = messages.map((msg) => {
    const obfuscatedUser = obfuscateUserId(msg.userId);
    const timestamp = new Date(parseFloat(msg.timestamp) * 1000).toISOString();
    return `[${timestamp}] ${obfuscatedUser}: ${msg.text}`;
  });

  return `THREAD HISTORY UPDATE: ${JSON.stringify(formattedMessages)}`;
}

export function getInitialInstructions(): string {
  return `You are a Slack Coding Agent. Please honor all other system instructions. Periodically you will be sent thread history in this format:

THREAD HISTORY UPDATE: ["[2024-06-01T12:00:00.000Z] User123: Hello, can you help me?", "[2024-06-01T12:01:00.000Z] User456: Sure, what do you need?"]

When you receive new thread history updates, store that in your memory and use it to provide answers that make sense in the context of the thread.`;
}

export async function fetchSlackThreadHistory(
  client: {
    conversations: {
      replies: (args: {
        channel: string;
        ts: string;
        inclusive: boolean;
      }) => Promise<{ ok: boolean; messages?: SlackMessage[] }>;
    };
  },
  channel: string,
  threadTs: string,
  lastCodeyResponseTs?: string,
): Promise<SlackMessage[]> {
  try {
    // Fetch conversation replies for the thread
    const result = await client.conversations.replies({
      channel,
      ts: threadTs,
      inclusive: true,
    });

    if (!result.ok || !result.messages) {
      console.warn('Failed to fetch thread history:', result);
      return [];
    }

    const messages = result.messages as SlackMessage[];

    // Filter messages to only include those since the last Codey response
    let filteredMessages = messages;
    if (lastCodeyResponseTs) {
      const lastResponseTime = parseFloat(lastCodeyResponseTs);
      filteredMessages = messages.filter((msg) => {
        const msgTime = parseFloat(msg.ts);
        return msgTime > lastResponseTime;
      });
    }

    // Filter out bot messages and system messages
    return filteredMessages.filter(
      (msg) =>
        msg.type === 'message' &&
        msg.text &&
        msg.user &&
        !msg.text.startsWith(':loading:'), // Filter out our loading messages
    );
  } catch (error) {
    console.error('Error fetching thread history:', error);
    return [];
  }
}
