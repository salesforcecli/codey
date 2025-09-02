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
  text?: {
    type: string;
    text: string;
  };
  elements?: Array<{
    type: string;
    text: string;
  }>;
}

interface ToolBlockData {
  name: string;
  status: string;
  callId: string;
  params?: string;
  error?: string;
}

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
    (toolSection as any).accessory = {
      type: 'button',
      text: {
        type: 'plain_text',
        text: 'View Parameters',
        emoji: true,
      },
      action_id: 'view_tool_params',
      value: JSON.stringify({
        toolName: toolData.name,
        callId: toolData.callId,
        params: toolData.params,
      }),
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
): string | { blocks: SlackBlock[] } {
  const convertedText = convertMarkdownToSlackMrkdwn(text);

  if (!useBlocks) {
    return convertedText;
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
                blocks.push({
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: convertMarkdownToSlackMrkdwn(part),
                  },
                });
              }
            }
          } else {
            blocks.push({
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: convertMarkdownToSlackMrkdwn(beforeText),
              },
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
              blocks.push({
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: convertMarkdownToSlackMrkdwn(part),
                },
              });
            }
          }
        } else {
          blocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: convertMarkdownToSlackMrkdwn(afterText),
            },
          });
        }
      }
    }

    return { blocks };
  }

  // For simple text without special blocks, just return converted text
  return convertedText;
}
