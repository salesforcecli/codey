/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { WITTY_LOADING_PHRASES } from './witty-phrases';
import { PhraseCycler } from './phrase-cycler';
import {
  ServerGeminiStreamEvent,
  GeminiEventType,
} from '@google/gemini-cli-core';

process.on('SIGINT', () => {
  process.exit(0);
});

// Types and interfaces
interface SlackContext {
  teamId: string;
  botUserId?: string;
}

interface SlackEvent {
  channel: string;
  ts: string;
  user: string;
  thread_ts?: string;
  text?: string;
}

interface MessageStreamState {
  accumulated: string;
  lastUpdate: number;
  toolStatusLines: string[];
  toolCallMap: Map<string, string>; // callId -> toolName
  toolLineMap: Map<string, string>; // callId -> full tool line for precise replacement
  toolArgsMap: Map<string, Record<string, unknown>>; // callId -> original args
  lastBuiltText: string;
  messageTimestamps: string[]; // Track all message timestamps for multi-message responses
  currentMessageIndex: number; // Index of the current message being updated (for future use)
}

interface SlackClient {
  chat: {
    update: (params: {
      channel: string;
      ts: string;
      text?: string;
      blocks?: unknown[];
    }) => Promise<unknown>;
  };
  reactions: {
    add: (params: {
      channel: string;
      timestamp: string;
      name: string;
    }) => Promise<unknown>;
  };
  conversations: {
    replies: (args: {
      channel: string;
      ts: string;
      inclusive: boolean;
    }) => Promise<{
      ok: boolean;
      messages?: Array<{ text: string; ts: string; user: string }>;
    }>;
    info: (args: { channel: string }) => Promise<{
      ok: boolean;
      channel?: {
        id: string;
        name: string;
      };
    }>;
  };
}

interface HostedClient {
  createSession: (workspaceRoot: string) => Promise<{ sessionId: string }>;
  sendMessage: (
    sessionId: string,
    workspaceRoot: string,
    message: string,
  ) => Promise<{ response: string }>;
  sendMessageStream: (
    sessionId: string,
    workspaceRoot: string,
    message: string,
  ) => AsyncIterable<ServerGeminiStreamEvent>;
}

interface SessionStore {
  getKey: (teamId: string, channelId: string, threadTs?: string) => string;
  get: (key: string) => SessionMapping | undefined;
  set: (key: string, mapping: SessionMapping) => void;
  addMessage: (key: string, message: ThreadMessage) => void;
  updateLastCodeyResponse: (key: string, timestamp: string) => void;
}

interface SessionMapping {
  sessionId: string;
  workspaceRoot: string;
  threadMessages: ThreadMessage[];
  lastCodeyResponseTs?: string;
}

interface ThreadMessage {
  text: string;
  timestamp: string;
  userId: string;
}

interface ThreadHistory {
  fetchSlackThreadHistory: (
    client: SlackClient,
    channel: string,
    threadTs: string,
    lastCodeyResponseTs?: string,
  ) => Promise<Array<{ text: string; ts: string; user: string }>>;
  formatThreadContext: (messages: ThreadMessage[], limit: number) => string;
}

interface FormatSlackMessage {
  (text: string): string | { text?: string; blocks?: unknown[] };
}

// Constants
const EMOJIS = {
  loading: 'loading',
  error: 'x',
  completed: 'large_green_circle',
  running: 'large_blue_circle',
} as const;

const CONFIG = {
  minUpdateIntervalMs: 300,
  phraseCycleIntervalMs: 10000,
  threadContextLimit: 50,
  slackMessageLimit: 40000, // Slack's actual character limit
  slackMessageSplitThreshold: 38000, // Split before hitting the limit to account for loading phrases and formatting
} as const;

// Utility functions
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getRandomLoadingPhrase(): string {
  return `:${EMOJIS.loading}: ${
    WITTY_LOADING_PHRASES[
      Math.floor(Math.random() * WITTY_LOADING_PHRASES.length)
    ]
  }`;
}

// Session management functions
class SessionManager {
  constructor(
    private hosted: HostedClient,
    private sessionStore: SessionStore,
    private defaultWorkspaceRoot: string,
  ) {}

  async ensureThreadSession(
    teamId: string,
    channelId: string,
    threadTs?: string,
  ): Promise<{
    sessionId: string;
    conversationKey: string;
    isNewSession: boolean;
  }> {
    const conversationKey = this.sessionStore.getKey(
      teamId,
      channelId,
      threadTs,
    );
    const existing = this.sessionStore.get(conversationKey);

    if (existing) {
      return {
        sessionId: existing.sessionId,
        conversationKey,
        isNewSession: false,
      };
    }

    // Create new session for this thread
    const { sessionId } = await this.hosted.createSession(
      this.defaultWorkspaceRoot,
    );
    this.sessionStore.set(conversationKey, {
      sessionId,
      workspaceRoot: this.defaultWorkspaceRoot,
      threadMessages: [],
    });

    return { sessionId, conversationKey, isNewSession: true };
  }

  async recreateSession(
    conversationKey: string,
    existingMapping: SessionMapping,
  ): Promise<string> {
    const recreated = await this.hosted.createSession(
      this.defaultWorkspaceRoot,
    );
    this.sessionStore.set(conversationKey, {
      sessionId: recreated.sessionId,
      workspaceRoot: this.defaultWorkspaceRoot,
      threadMessages: existingMapping.threadMessages,
      lastCodeyResponseTs: existingMapping.lastCodeyResponseTs,
    });
    return recreated.sessionId;
  }
}

// Message streaming and update functions
class MessageStreamer {
  client: SlackClient | null;

  constructor(
    client: SlackClient | null,
    private formatSlackMessage: FormatSlackMessage,
  ) {
    this.client = client;
  }

  /**
   * Formats tool parameters for display, truncating values if needed
   */
  private formatToolParams(args: Record<string, unknown> | undefined): string {
    if (!args || Object.keys(args).length === 0) {
      return '';
    }

    const paramLines = Object.entries(args).map(([key, value]) => {
      let valueStr = '';
      if (typeof value === 'string') {
        valueStr = value.length > 100 ? `${value.substring(0, 100)}...` : value;
      } else if (value !== null && value !== undefined) {
        const jsonStr = JSON.stringify(value);
        valueStr =
          jsonStr.length > 100 ? `${jsonStr.substring(0, 100)}...` : jsonStr;
      } else {
        valueStr = String(value);
      }
      return `  - ${key}: ${valueStr}`;
    });

    return `\nparams:\n${paramLines.join('\n')}`;
  }

  /**
   * Creates a formatted tool message with Block Kit and interactive button:
   * Uses Block Kit blocks with a "View Parameters" button that opens a modal
   */
  private createToolMessage(
    toolName: string,
    status: 'running' | 'completed' | 'error',
    args?: Record<string, unknown>,
    errorMessage?: string,
    callId?: string,
  ): string {
    const statusEmoji =
      status === 'running'
        ? `:${EMOJIS.running}:`
        : status === 'completed'
          ? `:${EMOJIS.completed}:`
          : `:${EMOJIS.error}:`;

    // Create a special marker for Block Kit tool blocks
    const toolId =
      callId || `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create tool block marker that will be converted to Block Kit by formatSlackMessage
    let toolBlock = `[TOOL_BLOCK_START:${toolId}]
TOOL_NAME:${toolName}
TOOL_STATUS:${statusEmoji}
TOOL_CALL_ID:${toolId}`;

    if (args && Object.keys(args).length > 0) {
      toolBlock += `
TOOL_PARAMS:${JSON.stringify(args)}`;
    }

    if (errorMessage) {
      toolBlock += `
TOOL_ERROR:${errorMessage}`;
    }

    toolBlock += `
[TOOL_BLOCK_END:${toolId}]`;

    return toolBlock;
  }

  async updateSlackMessage(
    channel: string,
    messageTs: string,
    text: string,
    loadingPhrase?: string,
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Slack client not initialized');
    }

    const displayText = loadingPhrase
      ? `${text}\n\n:${EMOJIS.loading}: ${loadingPhrase}`
      : text;
    const formattedMessage = this.formatSlackMessage(displayText);
    const updatePayload =
      typeof formattedMessage === 'string'
        ? { text: formattedMessage }
        : formattedMessage;

    await this.client.chat.update({
      channel,
      ts: messageTs,
      ...updatePayload,
    });
  }

  async createNewMessage(
    channel: string,
    threadTs: string,
    text: string,
    say: (message: {
      thread_ts: string;
      text: string;
    }) => Promise<{ ts?: string }>,
    loadingPhrase?: string,
  ): Promise<string> {
    const displayText = loadingPhrase
      ? `${text}\n\n:${EMOJIS.loading}: ${loadingPhrase}`
      : text;

    const result = await say({
      thread_ts: threadTs,
      text: displayText,
    });

    if (!result.ts) {
      throw new Error('Failed to create new message - no timestamp returned');
    }

    return result.ts;
  }

  /**
   * Splits long text into multiple messages to avoid Slack's 40k character limit.
   * Attempts to split at line boundaries when possible. Tool status is now inline.
   */
  splitTextForSlack(text: string, toolStatusLines?: string[]): string[] {
    // toolStatusLines parameter kept for compatibility but not used since tools are now inline
    const fullText = text.trim();

    if (fullText.length <= CONFIG.slackMessageSplitThreshold) {
      return [fullText];
    }

    const messages: string[] = [];
    let currentMessage = '';
    const lines = fullText.split('\n');

    for (const line of lines) {
      const potentialMessage = currentMessage
        ? `${currentMessage}\n${line}`
        : line;

      // Check if adding this line would exceed the threshold
      if (potentialMessage.length > CONFIG.slackMessageSplitThreshold) {
        if (currentMessage) {
          // Save current message and start a new one
          messages.push(currentMessage.trim());
          currentMessage = line;
        } else {
          // Single line is too long, we need to split it
          const chunks = this.splitLongLine(
            line,
            CONFIG.slackMessageSplitThreshold,
          );
          messages.push(...chunks.slice(0, -1));
          currentMessage = chunks[chunks.length - 1];
        }
      } else {
        currentMessage = potentialMessage;
      }
    }

    if (currentMessage.trim()) {
      // Final safety check - if the message is too long, truncate it
      if (currentMessage.length > CONFIG.slackMessageLimit) {
        const truncatedMessage =
          `${currentMessage.substring(0, CONFIG.slackMessageLimit - 100)}...\n\n_[Message truncated]_`.trim();
        messages.push(truncatedMessage);
      } else {
        messages.push(currentMessage.trim());
      }
    }

    return messages.length > 0 ? messages : [''];
  }

  private splitLongLine(line: string, maxLength: number): string[] {
    if (line.length <= maxLength) {
      return [line];
    }

    const chunks: string[] = [];
    let remaining = line;

    while (remaining.length > maxLength) {
      // Try to split at word boundaries
      let splitIndex = maxLength;
      const lastSpace = remaining.lastIndexOf(' ', maxLength);
      if (lastSpace > maxLength * 0.7) {
        // Don't split too early
        splitIndex = lastSpace;
      }

      chunks.push(remaining.substring(0, splitIndex));
      remaining = remaining.substring(splitIndex).trim();
    }

    if (remaining) {
      chunks.push(remaining);
    }

    return chunks;
  }

  /**
   * Processes streaming events and updates the message state.
   * Tool status is now displayed inline as events arrive, with real-time status updates.
   */
  processStreamEvent(
    event: ServerGeminiStreamEvent,
    state: MessageStreamState,
  ): boolean {
    const rawType = (event as { type?: string })?.type;
    const isStreamCompleted = rawType === 'stream_completed';

    if (event.type === GeminiEventType.Content) {
      state.accumulated += event.value;
    } else if (event.type === GeminiEventType.ToolCallRequest) {
      const toolLine = this.createToolMessage(
        event.value.name,
        'running',
        event.value.args,
        undefined,
        event.value.callId,
      );

      // Add tool status directly to accumulated content
      state.accumulated += `\n\n${toolLine}`;

      // Keep track for precise updates using callId
      state.toolCallMap.set(event.value.callId, event.value.name);
      state.toolLineMap.set(event.value.callId, toolLine);
      state.toolArgsMap.set(event.value.callId, event.value.args || {});
      state.toolStatusLines.push(toolLine);
    } else if (event.type === GeminiEventType.ToolCallResponse) {
      const toolName =
        state.toolCallMap.get(event.value.callId) || event.value.callId;
      const oldToolLine = state.toolLineMap.get(event.value.callId);
      const originalArgs = state.toolArgsMap.get(event.value.callId);

      if (oldToolLine) {
        const newToolLine = this.createToolMessage(
          toolName,
          event.value.error ? 'error' : 'completed',
          originalArgs,
          event.value.error?.message,
          event.value.callId,
        );

        // Replace the exact tool line in accumulated content using precise match
        state.accumulated = state.accumulated.replace(oldToolLine, newToolLine);

        // Update the tracking maps
        state.toolLineMap.set(event.value.callId, newToolLine);
        const idx = state.toolStatusLines.findIndex((l) => l === oldToolLine);
        if (idx >= 0) {
          state.toolStatusLines[idx] = newToolLine;
        }
      }
    } else if (event.type === GeminiEventType.Error) {
      state.accumulated += `\n\nError: ${event.value.error.message}`;
    } else if (event.type === GeminiEventType.Finished) {
      state.accumulated += '\n\n';
    }

    return isStreamCompleted;
  }

  shouldUpdateMessage(
    now: number,
    lastUpdate: number,
    event: ServerGeminiStreamEvent,
    isStreamCompleted: boolean,
  ): boolean {
    const shouldForce =
      isStreamCompleted ||
      event.type === GeminiEventType.Error ||
      event.type === GeminiEventType.ToolCallResponse;

    return shouldForce || now - lastUpdate > CONFIG.minUpdateIntervalMs;
  }

  buildDisplayText(state: MessageStreamState): string {
    // Tools are now displayed inline, so just return the accumulated content
    return state.accumulated.trim();
  }

  /**
   * Updates multiple Slack messages when content is too long for a single message.
   * Creates new messages as needed and ensures loading phrases only appear on the newest message.
   */
  async updateMultipleMessages(
    channel: string,
    state: MessageStreamState,
    threadTs: string,
    loadingPhrase?: string,
    say?: (message: {
      thread_ts: string;
      text: string;
    }) => Promise<{ ts?: string }>,
  ): Promise<void> {
    const messageParts = this.splitTextForSlack(state.accumulated);

    // Limit the number of messages to prevent spam (Slack has rate limits)
    const maxMessages = 10;
    const limitedMessageParts = messageParts.slice(0, maxMessages);

    if (messageParts.length > maxMessages) {
      // Add a note to the last message that content was truncated
      const lastIndex = limitedMessageParts.length - 1;
      limitedMessageParts[lastIndex] +=
        `\n\n_[Response split into ${messageParts.length} parts, showing first ${maxMessages}. Ask for continuation if needed.]_`;
    }

    // Ensure we have enough message timestamps
    while (state.messageTimestamps.length < limitedMessageParts.length) {
      if (!say) {
        throw new Error('Cannot create new messages without say function');
      }

      const newTs = await this.createNewMessage(
        channel,
        threadTs,
        '',
        say,
        undefined,
      );
      state.messageTimestamps.push(newTs);
    }

    // Update all messages
    for (let i = 0; i < limitedMessageParts.length; i++) {
      const isLastMessage = i === limitedMessageParts.length - 1;
      const messageText = limitedMessageParts[i];
      const shouldShowLoading = isLastMessage && loadingPhrase;

      // Final safety check before updating
      const finalText = shouldShowLoading
        ? `${messageText}\n\n:${EMOJIS.loading}: ${loadingPhrase}`
        : messageText;

      if (finalText.length > CONFIG.slackMessageLimit) {
        console.warn(
          `Message ${i} still too long (${finalText.length} chars), truncating further`,
        );
        const truncated =
          messageText.substring(0, CONFIG.slackMessageLimit - 100) +
          '\n\n_[Message truncated due to length]_';
        await this.updateSlackMessage(
          channel,
          state.messageTimestamps[i],
          truncated,
          shouldShowLoading ? loadingPhrase : undefined,
        );
      } else {
        await this.updateSlackMessage(
          channel,
          state.messageTimestamps[i],
          messageText,
          shouldShowLoading ? loadingPhrase : undefined,
        );
      }
    }

    // Update current message index
    state.currentMessageIndex = limitedMessageParts.length - 1;
  }
}

// Error handling functions
class ErrorHandler {
  client: SlackClient | null;

  constructor(
    client: SlackClient | null,
    private formatSlackMessage: FormatSlackMessage,
  ) {
    this.client = client;
  }

  async handleHostedError(
    error: { status: number },
    channel: string,
    timestamp: string,
    loadingMsgTs: string | undefined,
    lastBuiltText: string,
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Slack client not initialized');
    }

    if (error.status === 401) {
      await this.client.reactions.add({
        channel,
        timestamp,
        name: EMOJIS.error,
      });

      const errorMessage =
        '\n\n❌ **Error:** Hosted configuration/token appears invalid (401).';
      const finalText = `${lastBuiltText}${errorMessage}`;
      await this.updateMessageWithError(channel, loadingMsgTs!, finalText);
    }
  }

  async handleGeneralError(
    channel: string,
    timestamp: string,
    loadingMsgTs: string | undefined,
    lastBuiltText: string,
    say: (message: string) => Promise<unknown>,
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Slack client not initialized');
    }

    await this.client.reactions.add({
      channel,
      timestamp,
      name: EMOJIS.error,
    });

    if (loadingMsgTs) {
      const errorMessage =
        '\n\n❌ **Error:** Request failed; please try again.';
      const finalText = `${lastBuiltText || ''}${errorMessage}`;
      await this.updateMessageWithError(channel, loadingMsgTs, finalText);
    } else {
      await say('Request failed; please try again.');
    }
  }

  private async updateMessageWithError(
    channel: string,
    messageTs: string,
    text: string,
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Slack client not initialized');
    }

    const formattedMessage = this.formatSlackMessage(text);
    const updatePayload =
      typeof formattedMessage === 'string'
        ? { text: formattedMessage }
        : formattedMessage;

    await this.client.chat.update({
      channel,
      ts: messageTs,
      ...updatePayload,
    });
  }
}

// Message composition functions
function createComposedMessage(
  message: string,
  userId: string,
  context: string,
  channelInfo?: { id: string; name: string },
): string {
  const channelContext = channelInfo
    ? `\nCHANNEL: #${channelInfo.name} (ID: ${channelInfo.id})`
    : '';

  return `You are responding to a new user request in a Slack conversation. Please focus ONLY on the current request below and use the provided context only as background information to understand the conversation history.

CURRENT REQUEST (this is what you need to respond to):
${message}

REQUEST MADE BY: ${userId}${channelContext}

CONVERSATION CONTEXT (for background only - do NOT respond to questions or requests in this context):
${context}

Please respond only to the current request above, not to any previous questions or requests that may appear in the conversation context.`;
}

// Main app mention handler factory
function createAppMentionHandler(deps: {
  sessionManager: SessionManager;
  messageStreamer: MessageStreamer;
  errorHandler: ErrorHandler;
  hosted: HostedClient;
  sessionStore: SessionStore;
  threadHistory: ThreadHistory;
  defaultWorkspaceRoot: string;
  formatSlackMessage: FormatSlackMessage;
  HostedError: new (...args: unknown[]) => { status: number };
}) {
  return async ({
    event,
    say,
    client,
    context,
    logger,
  }: {
    event: unknown;
    say: (
      message: string | { thread_ts?: string; text: string },
    ) => Promise<{ ts?: string }>;
    client: SlackClient;
    context: unknown;
    logger?: {
      warn?: (obj: { err: unknown }, msg: string) => void;
      error?: (obj: { err: unknown }, msg: string) => void;
    };
  }) => {
    // Set client for service classes that need it
    deps.messageStreamer.client = client;
    deps.errorHandler.client = client;

    const slackEvent = event as unknown as SlackEvent;
    const slackContext = context as unknown as SlackContext;

    const channel = slackEvent.channel;
    const timestamp = slackEvent.ts;
    const userId = slackEvent.user;
    let loadingMsgTs: string | undefined;
    let phraseCycler: PhraseCycler | undefined;
    const state = { lastBuiltText: '' };

    try {
      const teamId = slackContext.teamId ?? 'default';
      const botUserId = slackContext.botUserId;
      const threadTs = slackEvent.thread_ts ?? slackEvent.ts;
      const rawText = slackEvent.text ?? '';
      const message = rawText.replace(/<@[^>]+>\s*/, '').trim();

      if (!message) {
        await say({ thread_ts: threadTs, text: 'Please include a message.' });
        return;
      }

      // Send initial loading message
      const loadingMsg = await say({
        thread_ts: threadTs,
        text: getRandomLoadingPhrase(),
      });
      loadingMsgTs = (loadingMsg as { ts?: string }).ts;

      // Start phrase cycling
      let currentLoadingPhrase = getRandomLoadingPhrase().replace(
        `:${EMOJIS.loading}: `,
        '',
      );
      phraseCycler = new PhraseCycler({
        intervalMs: CONFIG.phraseCycleIntervalMs,
        onPhraseChange: async (phrase: string) => {
          currentLoadingPhrase = phrase;
          try {
            // Prevent race condition: don't update if cycler has been stopped
            if (loadingMsgTs && phraseCycler?.isRunning()) {
              // For phrase cycling, we need to create a temporary state to use updateMultipleMessages
              // But we need access to the current streamState, so we'll use the simpler approach
              // and update only the last message with the loading phrase
              const messageParts = deps.messageStreamer.splitTextForSlack(
                state.lastBuiltText,
              );
              if (messageParts.length === 1) {
                // Single message, use the original method
                await deps.messageStreamer.updateSlackMessage(
                  channel,
                  loadingMsgTs,
                  state.lastBuiltText,
                  currentLoadingPhrase,
                );
              } else {
                // Multiple messages would be needed, but we don't have access to streamState here
                // So we'll just update the first message without loading phrase to avoid errors
                await deps.messageStreamer.updateSlackMessage(
                  channel,
                  loadingMsgTs,
                  messageParts[0],
                  undefined,
                );
              }
            }
          } catch (err) {
            logger?.warn?.({ err }, 'Failed to update loading phrase');
          }
        },
      });
      phraseCycler.start();

      const { sessionId, conversationKey } =
        await deps.sessionManager.ensureThreadSession(
          teamId,
          channel,
          threadTs,
        );

      // Handle thread history updates
      await updateThreadHistory(
        deps,
        conversationKey,
        threadTs,
        channel,
        client,
      );

      // Get channel information
      const channelInfo = await getChannelInfo(client, channel);

      try {
        await handleMessageStreaming(deps, {
          sessionId,
          conversationKey,
          message,
          userId,
          channel,
          loadingMsgTs: loadingMsgTs!,
          phraseCycler,
          lastBuiltText: state.lastBuiltText,
          botUserId,
          state,
          channelInfo,
          threadTs,
          say,
        });
      } catch (err) {
        await handleStreamingError(deps, err, {
          conversationKey,
          message,
          userId,
          channel,
          timestamp,
          loadingMsgTs: loadingMsgTs!,
          phraseCycler,
          lastBuiltText: state.lastBuiltText,
          botUserId,
          channelInfo,
        });
      }
    } catch (err) {
      console.error('❌ Failed to handle app_mention:', err);
      logger?.error?.({ err }, 'Failed to handle app_mention');

      phraseCycler?.stop();
      await deps.errorHandler.handleGeneralError(
        channel,
        timestamp,
        loadingMsgTs,
        state.lastBuiltText,
        say,
      );
    }
  };
}

// Helper functions for the main handler
async function getChannelInfo(
  client: SlackClient,
  channelId: string,
): Promise<{ id: string; name: string } | undefined> {
  try {
    const result = await client.conversations.info({ channel: channelId });
    if (result.ok && result.channel) {
      return {
        id: result.channel.id,
        name: result.channel.name,
      };
    }
  } catch (err) {
    console.warn('Failed to fetch channel info:', err);
  }
  return undefined;
}

async function updateThreadHistory(
  deps: {
    sessionStore: SessionStore;
    threadHistory: ThreadHistory;
  },
  conversationKey: string,
  threadTs: string | undefined,
  channel: string,
  client: SlackClient,
): Promise<void> {
  const mapping = deps.sessionStore.get(conversationKey);
  if (!mapping) {
    throw new Error('Session mapping not found after creation');
  }

  if (threadTs) {
    const slackMessages = await deps.threadHistory.fetchSlackThreadHistory(
      client,
      channel,
      threadTs,
      mapping.lastCodeyResponseTs,
    );

    for (const slackMsg of slackMessages) {
      const threadMessage = {
        text: slackMsg.text,
        timestamp: slackMsg.ts,
        userId: slackMsg.user,
      };
      deps.sessionStore.addMessage(conversationKey, threadMessage);
    }
  }
}

async function handleMessageStreaming(
  deps: {
    hosted: HostedClient;
    sessionStore: SessionStore;
    threadHistory: ThreadHistory;
    messageStreamer: MessageStreamer;
    defaultWorkspaceRoot: string;
  },
  params: {
    sessionId: string;
    conversationKey: string;
    message: string;
    userId: string;
    channel: string;
    loadingMsgTs: string;
    phraseCycler: PhraseCycler;
    lastBuiltText: string;
    botUserId?: string;
    state: { lastBuiltText: string };
    channelInfo?: { id: string; name: string };
    threadTs: string;
    say: (message: {
      thread_ts: string;
      text: string;
    }) => Promise<{ ts?: string }>;
  },
): Promise<void> {
  const updatedMapping = deps.sessionStore.get(params.conversationKey)!;
  const context = deps.threadHistory.formatThreadContext(
    updatedMapping.threadMessages,
    CONFIG.threadContextLimit,
  );

  const composedMessage = createComposedMessage(
    params.message,
    params.userId,
    context,
    params.channelInfo,
  );

  const streamState: MessageStreamState = {
    accumulated: '',
    lastUpdate: 0,
    toolStatusLines: [],
    toolCallMap: new Map(),
    toolLineMap: new Map(),
    toolArgsMap: new Map(),
    lastBuiltText: '',
    messageTimestamps: [params.loadingMsgTs], // Start with the initial loading message
    currentMessageIndex: 0,
  };

  // Process the stream
  for await (const event of deps.hosted.sendMessageStream(
    params.sessionId,
    deps.defaultWorkspaceRoot,
    composedMessage,
  )) {
    const now = Date.now();
    const isStreamCompleted = deps.messageStreamer.processStreamEvent(
      event,
      streamState,
    );

    if (
      deps.messageStreamer.shouldUpdateMessage(
        now,
        streamState.lastUpdate,
        event as ServerGeminiStreamEvent,
        isStreamCompleted,
      )
    ) {
      streamState.lastUpdate = now;
      const displayText = deps.messageStreamer.buildDisplayText(streamState);
      streamState.lastBuiltText = displayText;
      params.state.lastBuiltText = displayText;

      const loadingPhrase = params.phraseCycler?.isRunning()
        ? params.phraseCycler.getCurrentPhrase()
        : undefined;

      // Use multi-message update to handle long content
      await deps.messageStreamer.updateMultipleMessages(
        params.channel,
        streamState,
        params.threadTs,
        loadingPhrase,
        params.say,
      );
    }

    if (isStreamCompleted) {
      // Stop phrase cycling immediately when stream completes to prevent race condition
      params.phraseCycler?.stop();
      break;
    }
  }

  // Finalize the message (phraseCycler already stopped above)
  await deps.messageStreamer.updateMultipleMessages(
    params.channel,
    streamState,
    params.threadTs,
    undefined, // No loading phrase for final message
    params.say,
  );

  // Record final response to thread store
  deps.sessionStore.addMessage(params.conversationKey, {
    text: streamState.accumulated,
    timestamp: params.loadingMsgTs,
    userId: params.botUserId || 'codey-bot',
  });

  deps.sessionStore.updateLastCodeyResponse(
    params.conversationKey,
    params.loadingMsgTs,
  );
}

async function handleStreamingError(
  deps: {
    sessionManager: SessionManager;
    sessionStore: SessionStore;
    threadHistory: ThreadHistory;
    messageStreamer: MessageStreamer;
    errorHandler: ErrorHandler;
    hosted: HostedClient;
    defaultWorkspaceRoot: string;
    HostedError: new (...args: unknown[]) => { status: number };
  },
  err: unknown,
  params: {
    conversationKey: string;
    message: string;
    userId: string;
    channel: string;
    timestamp: string;
    loadingMsgTs: string;
    phraseCycler: PhraseCycler;
    lastBuiltText: string;
    botUserId?: string;
    channelInfo?: { id: string; name: string };
  },
): Promise<void> {
  if (err instanceof deps.HostedError && err.status === 404) {
    // Recreate session and retry
    const mapping = deps.sessionStore.get(params.conversationKey);
    if (!mapping) {
      throw new Error('Session mapping not found');
    }
    const recreatedSessionId = await deps.sessionManager.recreateSession(
      params.conversationKey,
      mapping,
    );

    const updatedMapping = deps.sessionStore.get(params.conversationKey)!;
    const context = deps.threadHistory.formatThreadContext(
      updatedMapping.threadMessages,
      CONFIG.threadContextLimit,
    );
    const composedMessage = createComposedMessage(
      params.message,
      params.userId,
      context,
      params.channelInfo,
    );

    const result = await deps.hosted.sendMessage(
      recreatedSessionId,
      deps.defaultWorkspaceRoot,
      composedMessage,
    );

    params.phraseCycler?.stop();

    // Handle potentially long responses by splitting if needed
    const messageParts = deps.messageStreamer.splitTextForSlack(
      result.response,
    );
    if (messageParts.length === 1) {
      // Single message, use the original method
      await deps.messageStreamer.updateSlackMessage(
        params.channel,
        params.loadingMsgTs,
        result.response,
      );
    } else {
      // Multiple messages needed - we need to create a temporary state and use say function
      // For now, let's just truncate to avoid the error and add a note
      const truncatedResponse =
        result.response.length > CONFIG.slackMessageSplitThreshold
          ? `${result.response.substring(0, CONFIG.slackMessageSplitThreshold - 100)}\n\n_[Response truncated due to length - please ask for continuation if needed]_`
          : result.response;

      await deps.messageStreamer.updateSlackMessage(
        params.channel,
        params.loadingMsgTs,
        truncatedResponse,
      );
    }

    deps.sessionStore.addMessage(params.conversationKey, {
      text: result.response,
      timestamp: params.loadingMsgTs,
      userId: params.botUserId || 'codey-bot',
    });

    deps.sessionStore.updateLastCodeyResponse(
      params.conversationKey,
      params.loadingMsgTs,
    );
    return;
  }

  if (err instanceof deps.HostedError && err.status === 401) {
    params.phraseCycler?.stop();
    await deps.errorHandler.handleHostedError(
      err,
      params.channel,
      params.timestamp,
      params.loadingMsgTs,
      params.lastBuiltText,
    );
    return;
  }

  throw err;
}

async function main(): Promise<void> {
  console.log('🚀 Starting codey-slack app...');

  // Required for Socket Mode
  const botToken = requireEnv('SLACK_BOT_TOKEN');
  const appToken = requireEnv('SLACK_APP_TOKEN');

  console.log('✅ Environment variables loaded');
  console.log(`Bot token: ${botToken.substring(0, 12)}...`);
  console.log(`App token: ${appToken.substring(0, 12)}...`);

  // Dynamic import to handle module resolution issues
  const slackBolt = await import('@slack/bolt');
  const { App, LogLevel } = slackBolt;

  console.log('✅ Slack Bolt imported successfully');

  const logLevel =
    (process.env
      .SLACK_LOG_LEVEL as unknown as (typeof LogLevel)[keyof typeof LogLevel]) ??
    LogLevel.DEBUG; // Changed to DEBUG for better troubleshooting

  // @ts-expect-error for now
  console.log(`📝 Log level set to: ${LogLevel[logLevel]}`);

  const app = new App({
    token: botToken,
    appToken,
    socketMode: true,
    logLevel,
  });

  console.log('✅ Slack App instance created');

  // Add error handler
  app.error(async (error) => {
    console.error('❌ Slack app error:', error);
  });

  // Minimal hosted integration for POC
  const { HostedClient, HostedError } = await import('./hosted-client');
  const { formatSlackMessage } = await import('./markdown-converter');
  const hostedBaseUrl = requireEnv('CODEY_HOSTED_BASE_URL');
  const hostedToken = requireEnv('CODEY_HOSTED_TOKEN');
  const hosted = new HostedClient(hostedBaseUrl, hostedToken);

  // Default workspace root required for POC
  const defaultWorkspaceRoot = requireEnv('CODEY_DEFAULT_WORKSPACE_ROOT');

  // Import session store and thread history utilities
  const sessionStore = await import('./session-store');
  const threadHistory = await import('./thread-history');

  // Initialize service classes
  const sessionManager = new SessionManager(
    hosted as HostedClient,
    sessionStore as SessionStore,
    defaultWorkspaceRoot,
  );
  const messageStreamer = new MessageStreamer(
    null,
    formatSlackMessage as FormatSlackMessage,
  );
  const errorHandler = new ErrorHandler(
    null,
    formatSlackMessage as FormatSlackMessage,
  );

  // Create the app mention handler
  const handleAppMention = createAppMentionHandler({
    sessionManager,
    messageStreamer,
    errorHandler,
    hosted: hosted as HostedClient,
    sessionStore: sessionStore as SessionStore,
    threadHistory: threadHistory as ThreadHistory,
    defaultWorkspaceRoot,
    formatSlackMessage: formatSlackMessage as FormatSlackMessage,
    HostedError: HostedError as new (...args: unknown[]) => { status: number },
  });

  // Register the event handler
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.event('app_mention', handleAppMention as any);

  // Register interaction handlers for tool parameter buttons
  app.action('view_tool_params', async ({ ack, body, client }) => {
    await ack();

    try {
      const buttonValue = JSON.parse((body as any).actions[0].value);
      const { toolName, callId, params } = buttonValue;

      // Parse parameters for display
      let paramBlocks = [];
      try {
        const parsedParams = JSON.parse(params);
        paramBlocks = Object.entries(parsedParams).map(([key, value]) => ({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${key}:*\n\`\`\`${JSON.stringify(value, null, 2)}\`\`\``,
          },
        }));
      } catch (e) {
        paramBlocks = [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `\`\`\`${params}\`\`\``,
            },
          },
        ];
      }

      // Create and open modal
      await client.views.open({
        trigger_id: (body as any).trigger_id,
        view: {
          type: 'modal',
          title: {
            type: 'plain_text',
            text: `Tool Parameters`,
            emoji: true,
          },
          close: {
            type: 'plain_text',
            text: 'Close',
            emoji: true,
          },
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: `🔧 ${toolName}`,
                emoji: true,
              },
            },
            {
              type: 'divider',
            },
            ...paramBlocks,
          ],
        },
      });
    } catch (error) {
      console.error('Error handling tool params button:', error);
    }
  });

  console.log('✅ Event handlers registered');

  const port = Number(process.env.PORT ?? 3001);

  console.log(`🔌 Starting app on port ${port}...`);
  await app.start(port);

  console.log(`⚡️ codey-slack running (Socket Mode) on port ${port}`);
  console.log('🎯 Ready to receive events!');
  console.log('');
  console.log('Test instructions:');
  console.log(
    '1. In Slack, mention your bot in any channel/DM: @YourBotName hello',
  );
  console.log('');
}

main().catch((err) => {
  console.error('💥 Fatal startup error:', err);
  process.exit(1);
});
