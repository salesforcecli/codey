/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import slackifyMarkdown from 'slackify-markdown';

/**
 * Converts common Markdown formatting to Slack's mrkdwn format using the slackify-markdown package.
 *
 * This function uses the slackify-markdown npm package to handle the conversion from standard Markdown
 * to Slack's mrkdwn format, which includes:
 *
 * - **bold** → *bold*
 * - *italic* → _italic_
 * - `code` → `code` (same)
 * - ```code blocks``` → ```code blocks``` (same)
 * - [link text](url) → <url|link text>
 * - ~~strikethrough~~ → ~strikethrough~
 * - Lists, headers, and other formatting
 *
 * @param markdown The markdown text to convert
 * @returns The text formatted for Slack's mrkdwn
 */
export function convertMarkdownToSlackMrkdwn(markdown: string): string {
  const converted = slackifyMarkdown(markdown);

  // Clean up the output:
  // 1. Remove invisible Unicode characters that slackify-markdown adds
  // 2. Trim trailing whitespace and newlines
  return converted
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
    .trim();
}

/**
 * Formats a message for Slack by converting markdown and optionally using Slack's Block Kit
 * for better formatting of code blocks and structured content.
 *
 * @param text The text content to format
 * @param useBlocks Whether to use Slack's Block Kit for enhanced formatting
 * @returns Either a simple text string or a Slack blocks structure
 */
interface SlackBlock {
  type: string;
  text?:
    | string
    | {
        type: string;
        text: string;
      };
  elements?: Array<{
    type: string;
    text?: string;
    elements?: Array<{
      type: string;
      text: string;
    }>;
  }>;
}

interface ToolBlockData {
  name: string;
  status: string;
  callId: string;
  params?: string;
  error?: string;
}

// Global parameter storage to avoid Slack's 2001 character button value limit
const toolParameterStorage = new Map<string, string>();

/**
 * Stores tool parameters and returns a storage key
 */
function storeToolParameters(callId: string, params: string): string {
  const storageKey = `params_${callId}_${Date.now()}`;
  toolParameterStorage.set(storageKey, params);

  // Clean up old entries to prevent memory leaks (keep last 100)
  if (toolParameterStorage.size > 100) {
    const entries = Array.from(toolParameterStorage.entries());
    const keepEntries = entries.slice(-50); // Keep last 50
    toolParameterStorage.clear();
    for (const [key, value] of keepEntries) {
      toolParameterStorage.set(key, value);
    }
  }

  return storageKey;
}

/**
 * Retrieves tool parameters from storage
 */
function getStoredToolParameters(storageKey: string): string | undefined {
  return toolParameterStorage.get(storageKey);
}

/**
 * Exports for use in the main index file
 */
export { getStoredToolParameters };

function parseToolBlock(toolBlockText: string): ToolBlockData | null {
  const lines = toolBlockText.split('\n');
  const data: Partial<ToolBlockData> = {};

  for (const line of lines) {
    if (line.startsWith('TOOL_NAME:')) {
      data.name = line.substring('TOOL_NAME:'.length).trim();
    } else if (line.startsWith('TOOL_STATUS:')) {
      data.status = line.substring('TOOL_STATUS:'.length).trim();
    } else if (line.startsWith('TOOL_CALL_ID:')) {
      data.callId = line.substring('TOOL_CALL_ID:'.length).trim();
    } else if (line.startsWith('TOOL_PARAMS:')) {
      data.params = line.substring('TOOL_PARAMS:'.length).trim();
    } else if (line.startsWith('TOOL_ERROR:')) {
      data.error = line.substring('TOOL_ERROR:'.length).trim();
    }
  }

  return data.name && data.status && data.callId
    ? (data as ToolBlockData)
    : null;
}

function createToolBlocks(toolData: ToolBlockData): SlackBlock[] {
  const blocks: SlackBlock[] = [];

  // Divider before tool
  // blocks.push({ type: 'divider' });

  // Main tool section with inline button
  const hasParams = toolData.params && toolData.params !== '{}';
  const toolSection: SlackBlock = {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `:wrench: ${toolData.status} *${toolData.name}*`,
    },
  };

  // Add button inline if there are parameters to show
  if (hasParams) {
    // Store parameters separately to avoid Slack's 2001 character limit on button values
    const storageKey = storeToolParameters(toolData.callId, toolData.params!);

    // Create a much smaller button value
    const buttonValue = {
      toolName: toolData.name,
      callId: toolData.callId,
      storageKey: storageKey,
      // Include a truncated preview for debugging
      preview:
        toolData.params!.length > 100
          ? `${toolData.params!.substring(0, 100)}...`
          : toolData.params!,
    };

    const buttonValueStr = JSON.stringify(buttonValue);

    // Final safety check - if still too long, truncate further
    let finalButtonValue = buttonValueStr;
    if (buttonValueStr.length > 1900) {
      // Create minimal button value
      const minimalValue = {
        toolName:
          toolData.name.length > 50
            ? `${toolData.name.substring(0, 50)}...`
            : toolData.name,
        callId: toolData.callId,
        storageKey: storageKey,
        truncated: true,
      };
      finalButtonValue = JSON.stringify(minimalValue);

      // Ultimate fallback if even minimal value is too long
      if (finalButtonValue.length > 1900) {
        finalButtonValue = JSON.stringify({
          callId: toolData.callId.substring(0, 20),
          storageKey: storageKey.substring(0, 50),
          minimal: true,
        });
      }
    }

    (toolSection as any).accessory = {
      type: 'button',
      text: {
        type: 'plain_text',
        text: 'View Parameters',
        emoji: true,
      },
      action_id: 'view_tool_params',
      value: finalButtonValue,
    };
  }

  blocks.push(toolSection);

  // Error section if present
  if (toolData.error) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Error:* ${toolData.error}`,
      },
    });
  }

  // Divider after tool
  // blocks.push({ type: 'divider' });

  return blocks;
}

export function formatSlackMessage(
  text: string,
  useBlocks: boolean = true, // Default to true for better formatting
  loadingPhrase?: string, // Optional loading phrase to display in separate section
): string | { blocks: SlackBlock[] } {
  const convertedText = convertMarkdownToSlackMrkdwn(text);

  if (!useBlocks) {
    // For non-block mode, append loading phrase if provided
    return loadingPhrase
      ? `${convertedText}\n\n${loadingPhrase}`
      : convertedText;
  }

  // Check for tool blocks first
  const toolBlockRegex =
    /\[TOOL_BLOCK_START:[^\]]+\]([\s\S]*?)\[TOOL_BLOCK_END:[^\]]+\]/g;
  const hasToolBlocks = toolBlockRegex.test(text);

  // Reset regex for actual processing
  toolBlockRegex.lastIndex = 0;

  // Check for code blocks
  const hasCodeBlocks = /```[\s\S]*?```/.test(text);

  if (hasToolBlocks || hasCodeBlocks) {
    const blocks: SlackBlock[] = [];
    let lastIndex = 0;
    let match;

    // Process tool blocks
    while ((match = toolBlockRegex.exec(text)) !== null) {
      // Add any text before this tool block
      if (match.index > lastIndex) {
        const beforeText = text.substring(lastIndex, match.index).trim();
        if (beforeText) {
          // Check if this text has code blocks
          if (/```[\s\S]*?```/.test(beforeText)) {
            const codeParts = beforeText.split(/(```[\s\S]*?```)/);
            for (const part of codeParts) {
              if (part.startsWith('```') && part.endsWith('```')) {
                const code = part.slice(3, -3).trim();
                blocks.push({
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `\`\`\`${code}\`\`\``,
                  },
                });
              } else if (part.trim()) {
                // Use markdown blocks for proper link unfurling and native markdown support
                blocks.push({
                  type: 'markdown',
                  text: part.trim(),
                });
              }
            }
          } else {
            // Use markdown blocks for proper link unfurling and native markdown support
            blocks.push({
              type: 'markdown',
              text: beforeText.trim(),
            });
          }
        }
      }

      // Parse and add the tool block
      const toolData = parseToolBlock(match[1]);
      if (toolData) {
        blocks.push(...createToolBlocks(toolData));
      }

      lastIndex = match.index + match[0].length;
    }

    // Add any remaining text after the last tool block
    if (lastIndex < text.length) {
      const afterText = text.substring(lastIndex).trim();
      if (afterText) {
        if (/```[\s\S]*?```/.test(afterText)) {
          const codeParts = afterText.split(/(```[\s\S]*?```)/);
          for (const part of codeParts) {
            if (part.startsWith('```') && part.endsWith('```')) {
              const code = part.slice(3, -3).trim();
              blocks.push({
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `\`\`\`${code}\`\`\``,
                },
              });
            } else if (part.trim()) {
              // Use markdown blocks for proper link unfurling and native markdown support
              blocks.push({
                type: 'markdown',
                text: part.trim(),
              });
            }
          }
        } else {
          // Use markdown blocks for proper link unfurling and native markdown support
          blocks.push({
            type: 'markdown',
            text: afterText.trim(),
          });
        }
      }
    }

    // Add loading phrase as a separate section if provided
    // This ensures it's always visible even if other sections are truncated
    if (loadingPhrase) {
      blocks.push({
        type: 'markdown',
        text: loadingPhrase,
      });
    }

    return { blocks };
  }

  // For simple text without special blocks
  if (loadingPhrase) {
    // Even for simple text, use blocks if we have a loading phrase to ensure visibility
    return {
      blocks: [
        {
          type: 'markdown',
          text: text.trim(),
        },
        {
          type: 'markdown',
          text: loadingPhrase,
        },
      ],
    };
  }

  return convertedText;
}
