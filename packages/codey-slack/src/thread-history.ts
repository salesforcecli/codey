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

import type { ThreadMessage } from './session-store';

export interface SlackMessage {
  text: string;
  ts: string;
  user: string;
  type: string;
}

// Removed obfuscation; we now display the Slack-provided user ID directly.

export function formatThreadContext(
  messages: ThreadMessage[],
  maxMessages: number = 50,
): string {
  const recent = maxMessages > 0 ? messages.slice(-maxMessages) : messages;
  const formatted = recent.map((msg) => {
    const timestamp = new Date(parseFloat(msg.timestamp) * 1000).toISOString();
    return `[${timestamp}] ${msg.userId}: ${msg.text}`;
  });
  return `Slack thread context (most recent ${formatted.length} message(s)):\n${formatted.join('\n')}`;
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
