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
  text: {
    type: string;
    text: string;
  };
}

export function formatSlackMessage(
  text: string,
  useBlocks: boolean = false,
): string | { blocks: SlackBlock[] } {
  const convertedText = convertMarkdownToSlackMrkdwn(text);

  if (!useBlocks) {
    return convertedText;
  }

  // For enhanced formatting, we can use Slack's Block Kit
  // This is useful for code blocks and structured content
  const hasCodeBlocks = /```[\s\S]*?```/.test(text);

  if (hasCodeBlocks) {
    const blocks: SlackBlock[] = [];
    const parts = text.split(/(```[\s\S]*?```)/);

    for (const part of parts) {
      if (part.startsWith('```') && part.endsWith('```')) {
        // Code block
        const code = part.slice(3, -3).trim();
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `\`\`\`${code}\`\`\``,
          },
        });
      } else if (part.trim()) {
        // Regular text
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: convertMarkdownToSlackMrkdwn(part),
          },
        });
      }
    }

    return { blocks };
  }

  // For simple text without code blocks, just return converted text
  return convertedText;
}
