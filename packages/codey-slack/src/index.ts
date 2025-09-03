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

import { WITTY_LOADING_PHRASES } from './witty-phrases';
import { PhraseCycler } from './phrase-cycler';
import {
  type ServerGeminiStreamEvent,
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

interface ToolBlockInfo {
  id: string;
  startIndex: number;
  endIndex: number;
  content: string;
  status: 'running' | 'completed' | 'error';
}

interface ValidationResult {
  isValid: boolean;
  error?: string;
}

interface MessageStreamState {
  accumulated: string;
  lastUpdate: number;
  toolStatusLines: string[];
  toolCallMap: Map<string, string>; // callId -> toolName
  toolLineMap: Map<string, string>; // callId -> full tool line for precise replacement
  toolArgsMap: Map<string, Record<string, unknown>>; // callId -> original args
  toolBlocks: Map<string, ToolBlockInfo>; // callId -> tool block info for atomic updates
  lastBuiltText: string;
  messageTimestamps: string[]; // Track all message timestamps for multi-message responses
  currentMessageIndex: number; // Index of the current message being updated (for future use)
  pendingUpdates: Map<string, NodeJS.Timeout>; // callId -> timeout for debouncing
  lastContentHash: string; // Hash of last sent content to detect meaningful changes
  batchUpdateTimeout?: NodeJS.Timeout; // Timeout for batching updates
  isUpdating: boolean; // Flag to prevent concurrent updates
  // New: Content buffering state
  contentBuffer: string; // Buffer for incomplete sentences/paragraphs
  lastContentUpdate: number; // Timestamp of last content addition for phrase cycling
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

interface Client {
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
  (
    text: string,
    useBlocks?: boolean,
    loadingPhrase?: string,
  ): string | { text?: string; blocks?: unknown[] };
}

// Constants
const EMOJIS = {
  loading: 'loading',
  error: 'x',
  completed: 'large_green_circle',
  running: 'large_blue_circle',
} as const;

const CONFIG = {
  minUpdateIntervalMs: 800, // Increased from 300ms to reduce choppiness
  phraseCycleIntervalMs: 15000, // Increased from 10s to 15s for less frequent phrase changes
  threadContextLimit: 50,
  slackMessageLimit: 40000, // Slack's actual character limit
  slackMessageSplitThreshold: 36000, // More conservative split to account for loading phrases, formatting, and tool blocks
  toolBlockMarkerSafetyBuffer: 500, // Extra buffer around tool blocks to prevent splitting
  maxMessagesPerResponse: 10, // Limit to prevent spam
  toolBlockTimeoutMs: 30000, // Timeout for tool block updates
  contentChangeThreshold: 50, // Minimum characters changed before updating
  toolStatusDebounceMs: 1000, // Debounce rapid tool status changes
  batchUpdateDelayMs: 200, // Small delay to batch rapid updates
  // New: Sentence/paragraph buffering options
  sentenceBuffering: true, // Enable sentence-aware updates
  minWordsBeforeUpdate: 8, // Minimum words before considering update
  quietPeriodForPhraseCycling: 2000, // Don't cycle phrases during active streaming (2s)
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
    private hosted: Client,
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
   * Validates a tool block to ensure it's properly formatted and safe to process
   */
  private validateToolBlock(toolBlockText: string): ValidationResult {
    try {
      // Check for complete markers
      if (
        !toolBlockText.includes('TOOL_NAME:') ||
        !toolBlockText.includes('TOOL_STATUS:') ||
        !toolBlockText.includes('TOOL_CALL_ID:')
      ) {
        return { isValid: false, error: 'Missing required tool block fields' };
      }

      // Check for nested tool blocks (security issue)
      const nestedBlockCount = (
        toolBlockText.match(/\[TOOL_BLOCK_START:/g) || []
      ).length;
      if (nestedBlockCount > 1) {
        return { isValid: false, error: 'Nested tool blocks detected' };
      }

      // Validate JSON parameters if present
      const paramsMatch = toolBlockText.match(/TOOL_PARAMS:(.+)/);
      if (paramsMatch) {
        try {
          JSON.parse(paramsMatch[1].trim());
        } catch {
          return { isValid: false, error: 'Invalid JSON in tool parameters' };
        }
      }

      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: `Validation error: ${error}` };
    }
  }

  /**
   * Extracts tool blocks from text and returns their positions for safe splitting
   */
  private extractToolBlocks(text: string): ToolBlockInfo[] {
    const toolBlocks: ToolBlockInfo[] = [];
    const regex =
      /\[TOOL_BLOCK_START:([^\]]+)\]([\s\S]*?)\[TOOL_BLOCK_END:[^\]]+\]/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const validation = this.validateToolBlock(match[0]);
      if (validation.isValid) {
        const callId = match[1];
        const statusMatch = match[2].match(/TOOL_STATUS:([^\n]+)/);
        const status = statusMatch
          ? statusMatch[1].includes('running')
            ? 'running'
            : statusMatch[1].includes('error')
              ? 'error'
              : 'completed'
          : 'running';

        toolBlocks.push({
          id: callId,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          content: match[0],
          status,
        });
      }
    }

    return toolBlocks;
  }

  /**
   * Calculates safe split points that don't break tool blocks
   */
  private findSafeSplitPoints(text: string, maxLength: number): number[] {
    const toolBlocks = this.extractToolBlocks(text);
    const splitPoints: number[] = [];
    const lines = text.split('\n');
    let currentLength = 0;
    let currentLineIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const potentialLength = currentLength + line.length + 1; // +1 for newline

      // Check if this line would exceed the limit
      if (potentialLength > maxLength && currentLength > 0) {
        // Check if we're inside a tool block
        const lineStart = text.indexOf(lines[currentLineIndex]);
        const isInsideToolBlock = toolBlocks.some(
          (block) =>
            lineStart >= block.startIndex && lineStart < block.endIndex,
        );

        if (!isInsideToolBlock) {
          // Safe to split here
          splitPoints.push(currentLength);
          currentLength = line.length + 1;
          currentLineIndex = i;
        } else {
          // Find the end of the tool block and split after it
          const containingBlock = toolBlocks.find(
            (block) =>
              lineStart >= block.startIndex && lineStart < block.endIndex,
          );
          if (containingBlock) {
            // Skip to after the tool block
            const blockEndLine =
              text.substring(0, containingBlock.endIndex).split('\n').length -
              1;
            if (blockEndLine > i) {
              i = blockEndLine;
              currentLength = containingBlock.endIndex;
              currentLineIndex = i + 1;
              splitPoints.push(currentLength);
            }
          }
        }
      } else {
        currentLength = potentialLength;
      }
    }

    return splitPoints;
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

    // Format loading phrase with emoji if provided
    const formattedLoadingPhrase = loadingPhrase
      ? `:${EMOJIS.loading}: ${loadingPhrase}`
      : undefined;

    // Use the enhanced formatSlackMessage that handles loading phrases separately
    const formattedMessage = this.formatSlackMessage(
      text,
      true,
      formattedLoadingPhrase,
    );
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
    // Format loading phrase with emoji if provided
    const formattedLoadingPhrase = loadingPhrase
      ? `:${EMOJIS.loading}: ${loadingPhrase}`
      : undefined;

    // Use the enhanced formatSlackMessage for consistent formatting
    const formattedMessage = this.formatSlackMessage(
      text,
      true,
      formattedLoadingPhrase,
    );
    const messagePayload =
      typeof formattedMessage === 'string'
        ? { thread_ts: threadTs, text: formattedMessage }
        : { thread_ts: threadTs, ...formattedMessage };

    const result = await say(
      messagePayload as unknown as {
        thread_ts: string;
        text: string;
      },
    );

    if (!result.ts) {
      throw new Error('Failed to create new message - no timestamp returned');
    }

    return result.ts;
  }

  /**
   * Splits long text into multiple messages to avoid Slack's 40k character limit.
   * Respects tool block boundaries and attempts to split at safe points.
   */
  splitTextForSlack(text: string): string[] {
    const fullText = text.trim();

    if (fullText.length <= CONFIG.slackMessageSplitThreshold) {
      return [fullText];
    }

    try {
      // Use safe splitting that respects tool block boundaries
      const splitPoints = this.findSafeSplitPoints(
        fullText,
        CONFIG.slackMessageSplitThreshold,
      );

      if (splitPoints.length === 0) {
        // Fallback to original logic if no safe split points found
        return this.fallbackSplit(fullText);
      }

      const messages: string[] = [];
      let lastIndex = 0;

      for (const splitPoint of splitPoints) {
        const chunk = fullText.substring(lastIndex, splitPoint).trim();
        if (chunk) {
          messages.push(chunk);
        }
        lastIndex = splitPoint;
      }

      // Add remaining text
      if (lastIndex < fullText.length) {
        const remaining = fullText.substring(lastIndex).trim();
        if (remaining) {
          if (remaining.length > CONFIG.slackMessageLimit) {
            // Final safety truncation
            const truncated = `${remaining.substring(0, CONFIG.slackMessageLimit - 150)}...\n\n_[Message truncated due to length]_`;
            messages.push(truncated);
          } else {
            messages.push(remaining);
          }
        }
      }

      return messages.length > 0
        ? messages
        : [fullText.substring(0, CONFIG.slackMessageLimit - 100)];
    } catch (error) {
      console.warn(
        'Error in safe text splitting, falling back to simple split:',
        error,
      );
      return this.fallbackSplit(fullText);
    }
  }

  /**
   * Fallback splitting method when safe splitting fails
   */
  private fallbackSplit(text: string): string[] {
    const messages: string[] = [];
    let currentMessage = '';
    const lines = text.split('\n');

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
   * Debounces rapid tool status updates to reduce choppiness
   */
  private debounceToolUpdate(
    state: MessageStreamState,
    callId: string,
    updateFn: () => void,
  ): void {
    // Clear existing timeout for this tool
    const existingTimeout = state.pendingUpdates.get(callId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      updateFn();
      state.pendingUpdates.delete(callId);
    }, CONFIG.toolStatusDebounceMs);

    state.pendingUpdates.set(callId, timeout);
  }

  /**
   * Batches multiple updates to reduce UI choppiness
   */
  batchUpdate(state: MessageStreamState, updateFn: () => Promise<void>): void {
    // Clear existing batch timeout
    if (state.batchUpdateTimeout) {
      clearTimeout(state.batchUpdateTimeout);
    }

    // Set new batch timeout
    state.batchUpdateTimeout = setTimeout(async () => {
      if (!state.isUpdating) {
        state.isUpdating = true;
        try {
          await updateFn();
        } finally {
          state.isUpdating = false;
        }
      }
      state.batchUpdateTimeout = undefined;
    }, CONFIG.batchUpdateDelayMs);
  }

  /**
   * Safely updates a tool's status using atomic operations based on call ID
   */
  private updateToolStatusAtomic(
    state: MessageStreamState,
    callId: string,
    newStatus: 'running' | 'completed' | 'error',
    errorMessage?: string,
  ): boolean {
    try {
      const toolBlock = state.toolBlocks.get(callId);
      const toolName = state.toolCallMap.get(callId);
      const originalArgs = state.toolArgsMap.get(callId);

      if (!toolBlock || !toolName) {
        console.warn(`Tool block not found for callId: ${callId}`);
        return false;
      }

      // Create new tool message
      const newToolLine = this.createToolMessage(
        toolName,
        newStatus,
        originalArgs,
        errorMessage,
        callId,
      );

      // Atomic replacement using precise indices
      const beforeBlock = state.accumulated.substring(0, toolBlock.startIndex);
      const afterBlock = state.accumulated.substring(toolBlock.endIndex);

      // Calculate new indices
      const newEndIndex = toolBlock.startIndex + newToolLine.length;

      // Update accumulated content atomically
      state.accumulated = beforeBlock + newToolLine + afterBlock;

      // Update tool block info
      const updatedBlock: ToolBlockInfo = {
        ...toolBlock,
        endIndex: newEndIndex,
        content: newToolLine,
        status: newStatus,
      };
      state.toolBlocks.set(callId, updatedBlock);

      // Adjust indices of subsequent tool blocks
      const indexDelta = newToolLine.length - toolBlock.content.length;
      if (indexDelta !== 0) {
        for (const [otherCallId, otherBlock] of state.toolBlocks.entries()) {
          if (
            otherCallId !== callId &&
            otherBlock.startIndex > toolBlock.endIndex
          ) {
            state.toolBlocks.set(otherCallId, {
              ...otherBlock,
              startIndex: otherBlock.startIndex + indexDelta,
              endIndex: otherBlock.endIndex + indexDelta,
            });
          }
        }
      }

      // Update legacy tracking for compatibility
      state.toolLineMap.set(callId, newToolLine);
      const idx = state.toolStatusLines.findIndex((l) => l.includes(callId));
      if (idx >= 0) {
        state.toolStatusLines[idx] = newToolLine;
      }

      return true;
    } catch (error) {
      console.error(`Failed to update tool status for ${callId}:`, error);
      return false;
    }
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
      state.lastContentUpdate = Date.now(); // Track when content was last added
    } else if (event.type === GeminiEventType.ToolCallRequest) {
      const toolLine = this.createToolMessage(
        event.value.name,
        'running',
        event.value.args,
        undefined,
        event.value.callId,
      );

      // Calculate insertion point
      const insertionPoint = state.accumulated.length;
      const toolContent = `\n\n${toolLine}`;

      // Add tool status directly to accumulated content
      state.accumulated += toolContent;

      // Create tool block info for atomic updates
      const toolBlockInfo: ToolBlockInfo = {
        id: event.value.callId,
        startIndex: insertionPoint + 2, // +2 for the \n\n
        endIndex: insertionPoint + toolContent.length,
        content: toolLine,
        status: 'running',
      };

      // Keep track for precise updates using callId
      state.toolCallMap.set(event.value.callId, event.value.name);
      state.toolLineMap.set(event.value.callId, toolLine);
      state.toolArgsMap.set(event.value.callId, event.value.args || {});
      state.toolBlocks.set(event.value.callId, toolBlockInfo);
      state.toolStatusLines.push(toolLine);
    } else if (event.type === GeminiEventType.ToolCallResponse) {
      // For tool completions, update immediately without debouncing
      // since users expect to see tool results right away
      const success = this.updateToolStatusAtomic(
        state,
        event.value.callId,
        event.value.error ? 'error' : 'completed',
        event.value.error?.message,
      );

      if (!success) {
        // Fallback to legacy method if atomic update fails
        console.warn(
          `Falling back to legacy update for tool ${event.value.callId}`,
        );
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

          // Only use string replacement as last resort
          if (state.accumulated.includes(oldToolLine)) {
            state.accumulated = state.accumulated.replace(
              oldToolLine,
              newToolLine,
            );
            state.toolLineMap.set(event.value.callId, newToolLine);
          }
        }
      }
    } else if (event.type === GeminiEventType.Error) {
      state.accumulated += `\n\nError: ${event.value.error.message}`;
    }

    return isStreamCompleted;
  }

  /**
   * Creates a simple hash of content to detect meaningful changes
   */
  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  /**
   * Checks if content represents a complete sentence or logical unit
   */
  private isCompleteSentence(content: string): boolean {
    const trimmed = content.trim();

    // Check for sentence endings
    if (/[.!?]\s*$/.test(trimmed)) {
      return true;
    }

    // Check for paragraph breaks (double newlines)
    if (/\n\n/.test(content)) {
      return true;
    }

    // Check for list items
    if (/\n[-*+]\s/.test(content) || /\n\d+\.\s/.test(content)) {
      return true;
    }

    // Check for code blocks
    if (content.includes('```')) {
      return true;
    }

    // Check for headers
    if (/\n#{1,6}\s/.test(content)) {
      return true;
    }

    return false;
  }

  /**
   * Counts words in content for minimum word threshold
   */
  private countWords(content: string): number {
    return content
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }

  /**
   * Checks if content has changed significantly enough to warrant an update
   * Now includes sentence/paragraph buffering logic
   */
  private hasSignificantContentChange(
    newContent: string,
    state: MessageStreamState,
  ): boolean {
    // If sentence buffering is enabled, use smarter logic
    if (CONFIG.sentenceBuffering) {
      const contentSinceLastUpdate = newContent.substring(
        state.lastBuiltText.length,
      );

      // Always update if we have a complete sentence/paragraph
      if (this.isCompleteSentence(contentSinceLastUpdate)) {
        return true;
      }

      // Check minimum word count threshold
      const wordsSinceUpdate = this.countWords(contentSinceLastUpdate);
      if (wordsSinceUpdate >= CONFIG.minWordsBeforeUpdate) {
        return true;
      }

      // Don't update for incomplete sentences with few words
      return false;
    }

    // Fallback to original hash-based logic
    const newHash = this.hashContent(newContent);
    if (!state.lastContentHash || state.lastContentHash !== newHash) {
      const lengthDiff = Math.abs(
        newContent.length - state.lastBuiltText.length,
      );
      if (lengthDiff >= CONFIG.contentChangeThreshold) {
        state.lastContentHash = newHash;
        return true;
      }
    }

    return false;
  }

  shouldUpdateMessage(
    now: number,
    lastUpdate: number,
    event: ServerGeminiStreamEvent,
    isStreamCompleted: boolean,
    state: MessageStreamState,
  ): boolean {
    // Always update on completion or errors
    const shouldForce =
      isStreamCompleted ||
      event.type === GeminiEventType.Error ||
      event.type === GeminiEventType.Finished;

    if (shouldForce) {
      return true;
    }

    // For tool responses, use debouncing
    if (event.type === GeminiEventType.ToolCallResponse) {
      return true; // Tool completions should be shown immediately
    }

    // For content updates, check timing and significance
    const timingOk = now - lastUpdate > CONFIG.minUpdateIntervalMs;
    if (!timingOk) {
      return false;
    }

    // Check if content has changed significantly
    return this.hasSignificantContentChange(state.accumulated, state);
  }

  /**
   * Cleans up tool tracking resources when stream completes or errors
   */
  cleanupToolTracking(streamState: MessageStreamState): void {
    try {
      // Clear all tracking maps to prevent memory leaks
      streamState.toolCallMap.clear();
      streamState.toolLineMap.clear();
      streamState.toolArgsMap.clear();
      streamState.toolBlocks.clear();

      // Clear tool status lines array
      streamState.toolStatusLines.length = 0;

      // Clear pending updates and timeouts
      for (const timeout of streamState.pendingUpdates.values()) {
        clearTimeout(timeout);
      }
      streamState.pendingUpdates.clear();

      if (streamState.batchUpdateTimeout) {
        clearTimeout(streamState.batchUpdateTimeout);
        streamState.batchUpdateTimeout = undefined;
      }

      // Reset other state that's no longer needed
      streamState.currentMessageIndex = 0;
      streamState.isUpdating = false;
      streamState.lastContentHash = '';
      streamState.contentBuffer = '';
      streamState.lastContentUpdate = 0;

      console.log('Tool tracking resources cleaned up successfully');
    } catch (error) {
      console.warn('Error during tool tracking cleanup:', error);
    }
  }

  /**
   * Validates the current state and performs maintenance
   */
  validateAndMaintainState(state: MessageStreamState): void {
    try {
      // Check for orphaned tool blocks (blocks without corresponding map entries)
      const orphanedBlocks: string[] = [];
      for (const [callId] of state.toolBlocks.entries()) {
        if (!state.toolCallMap.has(callId)) {
          orphanedBlocks.push(callId);
        }
      }

      // Clean up orphaned blocks
      for (const callId of orphanedBlocks) {
        state.toolBlocks.delete(callId);
        console.warn(`Cleaned up orphaned tool block: ${callId}`);
      }

      // Validate tool block indices are still correct
      for (const [callId, block] of state.toolBlocks.entries()) {
        if (
          block.startIndex >= state.accumulated.length ||
          block.endIndex > state.accumulated.length ||
          block.startIndex >= block.endIndex
        ) {
          console.warn(`Invalid tool block indices for ${callId}, removing`);
          state.toolBlocks.delete(callId);
        }
      }

      // Limit the size of tracking maps to prevent unbounded growth
      const maxTrackingSize = 100;
      if (state.toolCallMap.size > maxTrackingSize) {
        console.warn(
          `Tool tracking maps exceeded size limit (${state.toolCallMap.size}), performing cleanup`,
        );

        // Keep only the most recent entries
        const entries = Array.from(state.toolCallMap.entries());
        const keepEntries = entries.slice(-maxTrackingSize / 2); // Keep last half

        state.toolCallMap.clear();
        state.toolLineMap.clear();
        state.toolArgsMap.clear();

        for (const [callId, toolName] of keepEntries) {
          state.toolCallMap.set(callId, toolName);
          // Note: We lose some data here, but prevent memory issues
        }
      }
    } catch (error) {
      console.error('Error during state validation and maintenance:', error);
    }
  }

  buildDisplayText(state: MessageStreamState): string {
    // Perform maintenance on the state
    this.validateAndMaintainState(state);

    // Tools are now displayed inline, so just return the accumulated content
    return state.accumulated.trim();
  }

  /**
   * Comprehensive error handling for multi-message scenarios
   */
  async handleLongResponse(
    content: string,
    channel: string,
    state: MessageStreamState,
    threadTs: string,
    loadingPhrase?: string,
    say?: (message: {
      thread_ts: string;
      text: string;
    }) => Promise<{ ts?: string }>,
  ): Promise<void> {
    try {
      // Attempt multi-message approach
      await this.updateMultipleMessages(
        channel,
        state,
        threadTs,
        loadingPhrase,
        say,
      );
    } catch (error) {
      console.error(
        'Multi-message update failed, falling back to truncation:',
        error,
      );
      // Graceful fallback with user notification
      await this.fallbackToTruncation(content, channel, state, error as Error);
    }
  }

  /**
   * Fallback method when multi-message updates fail
   */
  private async fallbackToTruncation(
    content: string,
    channel: string,
    state: MessageStreamState,
    originalError: Error,
  ): Promise<void> {
    try {
      const truncatedContent =
        content.length > CONFIG.slackMessageSplitThreshold
          ? `${content.substring(0, CONFIG.slackMessageSplitThreshold - 200)}\n\n_[Response truncated due to technical limitations. Original error: ${originalError.message}. Please ask for continuation if needed.]_`
          : content;

      if (state.messageTimestamps.length > 0) {
        await this.updateSlackMessage(
          channel,
          state.messageTimestamps[0],
          truncatedContent,
        );
      }
    } catch (fallbackError) {
      console.error('Even fallback truncation failed:', fallbackError);
      // Last resort: try to update with minimal content
      if (state.messageTimestamps.length > 0) {
        try {
          await this.updateSlackMessage(
            channel,
            state.messageTimestamps[0],
            '_[Error displaying response. Please try again.]_',
          );
        } catch {
          // If even this fails, we can't do much more
          console.error('Complete failure to update Slack message');
        }
      }
    }
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
    try {
      const messageParts = this.splitTextForSlack(state.accumulated);

      // Limit the number of messages to prevent spam (Slack has rate limits)
      const maxMessages = CONFIG.maxMessagesPerResponse;
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

      // Update all messages with better error handling
      const updatePromises = limitedMessageParts.map(async (messageText, i) => {
        const isLastMessage = i === limitedMessageParts.length - 1;
        const shouldShowLoading = isLastMessage && loadingPhrase;

        // Check message length before adding loading phrase
        // Since loading phrase is now in a separate section, we don't need to account for it in length
        if (messageText.length > CONFIG.slackMessageLimit - 200) {
          // Leave buffer for loading section
          console.warn(
            `Message ${i} too long (${messageText.length} chars), truncating`,
          );
          const truncated =
            messageText.substring(0, CONFIG.slackMessageLimit - 300) +
            '\n\n_[Message truncated due to length]_';

          return this.updateSlackMessage(
            channel,
            state.messageTimestamps[i],
            truncated,
            shouldShowLoading ? loadingPhrase : undefined,
          );
        } else {
          return this.updateSlackMessage(
            channel,
            state.messageTimestamps[i],
            messageText,
            shouldShowLoading ? loadingPhrase : undefined,
          );
        }
      });

      // Wait for all updates to complete
      await Promise.all(updatePromises);

      // Update current message index
      state.currentMessageIndex = limitedMessageParts.length - 1;
    } catch (error) {
      console.error('Error in updateMultipleMessages:', error);
      throw error; // Re-throw to trigger fallback handling
    }
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

  async handleClientError(
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

    // No loading phrase for error messages
    const formattedMessage = this.formatSlackMessage(text, true, undefined);
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
  hosted: Client;
  sessionStore: SessionStore;
  threadHistory: ThreadHistory;
  defaultWorkspaceRoot: string;
  formatSlackMessage: FormatSlackMessage;
  ClientError: new (...args: unknown[]) => { status: number };
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
              // For phrase cycling, use context-aware timing to reduce choppiness
              // Don't cycle phrases when content is actively streaming
              // Use a simpler approach since we don't have access to streamState here
              const shouldUpdateLoadingPhrase = Math.random() < 0.4; // 40% chance

              if (shouldUpdateLoadingPhrase) {
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
                  // For multi-message responses, only update the loading phrase occasionally
                  // to avoid too much visual churn
                  await deps.messageStreamer.updateSlackMessage(
                    channel,
                    loadingMsgTs,
                    messageParts[0],
                    undefined,
                  );
                }
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
    hosted: Client;
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
    toolBlocks: new Map(), // Add the new toolBlocks map
    lastBuiltText: '',
    messageTimestamps: [params.loadingMsgTs], // Start with the initial loading message
    currentMessageIndex: 0,
    pendingUpdates: new Map(), // For debouncing tool updates
    lastContentHash: '', // For detecting significant changes
    isUpdating: false, // Prevent concurrent updates
    contentBuffer: '', // For sentence buffering
    lastContentUpdate: Date.now(), // Track content timing for phrase cycling
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
        streamState,
      )
    ) {
      streamState.lastUpdate = now;
      const displayText = deps.messageStreamer.buildDisplayText(streamState);
      streamState.lastBuiltText = displayText;
      params.state.lastBuiltText = displayText;

      const loadingPhrase = params.phraseCycler?.isRunning()
        ? params.phraseCycler.getCurrentPhrase()
        : undefined;

      // Use batching for smoother updates, except for critical events
      const isCriticalUpdate =
        isStreamCompleted ||
        event.type === GeminiEventType.Error ||
        event.type === GeminiEventType.ToolCallResponse;

      const updateFn = async () => {
        try {
          await deps.messageStreamer.updateMultipleMessages(
            params.channel,
            streamState,
            params.threadTs,
            loadingPhrase,
            params.say,
          );
        } catch (error) {
          console.error('Error during message update:', error);
          // Use comprehensive error handling
          await deps.messageStreamer.handleLongResponse(
            streamState.accumulated,
            params.channel,
            streamState,
            params.threadTs,
            loadingPhrase,
            params.say,
          );
        }
      };

      if (isCriticalUpdate || streamState.isUpdating) {
        // Update immediately for critical events or if already updating
        await updateFn();
      } else {
        // Batch non-critical updates to reduce choppiness
        deps.messageStreamer.batchUpdate(streamState, updateFn);
      }
    }

    if (isStreamCompleted) {
      // Stop phrase cycling immediately when stream completes to prevent race condition
      params.phraseCycler?.stop();
      break;
    }
  }

  // Finalize the message (phraseCycler already stopped above)
  try {
    // Clear any pending batched updates before final update
    if (streamState.batchUpdateTimeout) {
      clearTimeout(streamState.batchUpdateTimeout);
      streamState.batchUpdateTimeout = undefined;
    }

    // Clear any pending tool updates
    for (const timeout of streamState.pendingUpdates.values()) {
      clearTimeout(timeout);
    }
    streamState.pendingUpdates.clear();

    await deps.messageStreamer.updateMultipleMessages(
      params.channel,
      streamState,
      params.threadTs,
      undefined, // No loading phrase for final message
      params.say,
    );
  } finally {
    // Always clean up resources, even if final update fails
    deps.messageStreamer.cleanupToolTracking(streamState);
  }

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
    hosted: Client;
    defaultWorkspaceRoot: string;
    ClientError: new (...args: unknown[]) => { status: number };
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
  if (err instanceof deps.ClientError && err.status === 404) {
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

    // Handle potentially long responses with improved error handling
    try {
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
        // Create a temporary state for multi-message handling
        const tempState: MessageStreamState = {
          accumulated: result.response,
          lastUpdate: Date.now(),
          toolStatusLines: [],
          toolCallMap: new Map(),
          toolLineMap: new Map(),
          toolArgsMap: new Map(),
          toolBlocks: new Map(),
          lastBuiltText: result.response,
          messageTimestamps: [params.loadingMsgTs],
          currentMessageIndex: 0,
          pendingUpdates: new Map(),
          lastContentHash: '',
          isUpdating: false,
          contentBuffer: '',
          lastContentUpdate: Date.now(),
        };

        // Use comprehensive error handling for long responses
        await deps.messageStreamer.handleLongResponse(
          result.response,
          params.channel,
          tempState,
          params.loadingMsgTs, // Use loadingMsgTs as threadTs for error recovery
          undefined, // No loading phrase for error recovery
        );
      }
    } catch (updateError) {
      console.error(
        'Failed to update message during error recovery:',
        updateError,
      );
      // Last resort: simple truncation
      const truncatedResponse =
        result.response.length > CONFIG.slackMessageSplitThreshold
          ? `${result.response.substring(0, CONFIG.slackMessageSplitThreshold - 200)}\n\n_[Response truncated due to technical limitations. Please ask for continuation if needed.]_`
          : result.response;

      try {
        await deps.messageStreamer.updateSlackMessage(
          params.channel,
          params.loadingMsgTs,
          truncatedResponse,
        );
      } catch (finalError) {
        console.error('Complete failure to update message:', finalError);
      }
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

  if (err instanceof deps.ClientError && err.status === 401) {
    params.phraseCycler?.stop();
    await deps.errorHandler.handleClientError(
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
  const { Client, ClientError } = await import('./client');
  const { formatSlackMessage } = await import('./markdown-converter');
  const hostedBaseUrl = requireEnv('CODEY_HOSTED_BASE_URL');
  const hostedToken = requireEnv('CODEY_HOSTED_TOKEN');
  const hosted = new Client(hostedBaseUrl, hostedToken);

  // Default workspace root required for POC
  const defaultWorkspaceRoot = requireEnv('CODEY_DEFAULT_WORKSPACE_ROOT');

  // Import session store and thread history utilities
  const sessionStore = await import('./session-store');
  const threadHistory = await import('./thread-history');
  const { getStoredToolParameters } = await import('./markdown-converter');

  // Initialize service classes
  const sessionManager = new SessionManager(
    hosted as Client,
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
    hosted: hosted as Client,
    sessionStore: sessionStore as SessionStore,
    threadHistory: threadHistory as ThreadHistory,
    defaultWorkspaceRoot,
    formatSlackMessage: formatSlackMessage as FormatSlackMessage,
    ClientError: ClientError as new (...args: unknown[]) => { status: number },
  });

  // Register the event handler
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.event('app_mention', handleAppMention as any);

  // Register interaction handlers for tool parameter buttons
  app.action('view_tool_params', async ({ ack, body, client }) => {
    await ack();

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const buttonValue = JSON.parse((body as any).actions[0].value);
      const {
        toolName,
        callId,
        storageKey,
        params: directParams,
        truncated,
      } = buttonValue;

      // Get parameters from storage or use direct params (for backward compatibility)
      let params = directParams;
      if (storageKey) {
        const storedParams = getStoredToolParameters(storageKey);
        if (storedParams) {
          params = storedParams;
        } else {
          console.warn(
            `Tool parameters not found in storage for key: ${storageKey}`,
          );
          params = truncated
            ? '{"error": "Parameters were truncated and storage key not found"}'
            : directParams;
        }
      }

      // Parse parameters for display
      let paramBlocks = [];
      if (!params || params === '{}') {
        paramBlocks = [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '_No parameters provided for this tool call._',
            },
          },
        ];
      } else {
        try {
          const parsedParams = JSON.parse(params);
          paramBlocks = Object.entries(parsedParams).map(([key, value]) => {
            // Truncate very long values for display
            let displayValue = JSON.stringify(value, null, 2);
            if (displayValue.length > 1000) {
              displayValue = `${displayValue.substring(0, 1000)}...\n\n_[Value truncated for display]_`;
            }

            return {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*${key}:*\n\`\`\`${displayValue}\`\`\``,
              },
            };
          });
        } catch {
          // Fallback for non-JSON parameters
          let displayParams = params;
          if (displayParams.length > 1000) {
            displayParams = `${displayParams.substring(0, 1000)}...\n\n_[Content truncated for display]_`;
          }

          paramBlocks = [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `\`\`\`${displayParams}\`\`\``,
              },
            },
          ];
        }
      }

      // Create and open modal
      await client.views.open({
        trigger_id: (body as unknown as { trigger_id: string }).trigger_id,
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
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `Call ID: \`${callId}\`${storageKey ? ` | Storage: \`${storageKey}\`` : ''}`,
                },
              ],
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

      // Try to show an error modal
      try {
        await client.views.open({
          trigger_id: (body as unknown as { trigger_id: string }).trigger_id,
          view: {
            type: 'modal',
            title: {
              type: 'plain_text',
              text: 'Error',
              emoji: true,
            },
            close: {
              type: 'plain_text',
              text: 'Close',
              emoji: true,
            },
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `❌ *Error loading tool parameters*\n\n\`\`\`${error}\`\`\``,
                },
              },
            ],
          },
        });
      } catch {
        // If even the error modal fails, just log it
        console.error('Failed to show error modal for tool params');
      }
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
