/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Slack Canvas Tools - Create and append to Slack Channel Canvases
 *
 * This tool creates canvases within Slack channels using the conversations.canvases.create API.
 * Channel canvases are automatically accessible to all channel members.
 *
 * Requirements:
 * - SLACK_BOT_TOKEN environment variable
 * - canvases:write OAuth scope
 * - Paid Slack workspace (canvases not available on free plans)
 * - Bot must be added to the target channel
 *
 * URL Format: https://workspace.slack.com/docs/team_id/canvas_id
 * Example: https://e-bikesgroup.slack.com/docs/T09CE4KFS4U/F09CD2FBZRD
 */

import { SchemaValidator } from '../utils/schemaValidator.js';
import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
  ToolInvocation,
  ToolResult,
} from './tools.js';
import { getErrorMessage } from '../utils/errors.js';
import { Config } from '../config/config.js';
import { ProxyAgent, setGlobalDispatcher } from 'undici';

interface SlackApiResponse {
  ok: boolean;
  error?: string;
  canvas_id?: string;
  warning?: string;
  response_metadata?: {
    warnings?: string[];
  };
  [key: string]: unknown;
}

interface AuthTestResult {
  ok: boolean;
  team_id?: string;
  team?: string;
  url?: string;
  team_domain?: string;
  error?: string;
}

class SlackApiClient {
  private readonly token: string;
  private teamInfo: {
    team_id?: string;
    team_domain?: string;
  } | null = null;

  constructor(token: string, proxy?: string) {
    this.token = token;
    if (proxy) {
      setGlobalDispatcher(new ProxyAgent(proxy as string));
    }
  }

  async getTeamInfo(
    signal: AbortSignal,
  ): Promise<{ team_id?: string; team_domain?: string }> {
    if (this.teamInfo) {
      return this.teamInfo;
    }

    try {
      const res = await this.call<AuthTestResult>('auth.test', {}, signal);
      console.log('[SlackCanvas] auth.test response:', {
        ok: res.ok,
        team_id: res.team_id,
        team_domain: res.team_domain,
        url: res.url,
        error: res.error,
      });
      if (res.ok) {
        // Extract team_domain from URL if not directly provided
        let teamDomain = res.team_domain;
        if (!teamDomain && res.url) {
          // Extract domain from URL like "https://workspace.slack.com/"
          const urlMatch = res.url.match(/https:\/\/([^.]+)\.slack\.com/);
          if (urlMatch) {
            teamDomain = urlMatch[1];
          }
        }

        this.teamInfo = {
          team_id: res.team_id,
          team_domain: teamDomain,
        };
        return this.teamInfo;
      } else {
        console.warn('[SlackCanvas] auth.test failed:', res.error);
      }
    } catch (e) {
      console.warn('[SlackCanvas] Failed to get team info:', e);
    }

    this.teamInfo = {};
    return this.teamInfo;
  }

  async call<T = unknown>(
    method: string,
    body: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<SlackApiResponse & T> {
    const url = `https://slack.com/api/${method}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(body),
      signal,
    });
    const json = (await response.json()) as SlackApiResponse & T;
    return json;
  }
}

export interface SlackCanvasCreateToolParams {
  /**
   * Slack channel ID where the canvas will be created.
   */
  channel_id: string;
  /**
   * Title for the new canvas.
   */
  title: string;
  /**
   * Markdown content to initialize the canvas with.
   */
  content_markdown: string;
}

export interface SlackCanvasAppendToolParams {
  /**
   * Canvas ID to append content to.
   */
  canvas_id: string;
  /**
   * Markdown content to append to the canvas.
   */
  content_markdown: string;
}

class SlackCanvasCreateInvocation extends BaseToolInvocation<
  SlackCanvasCreateToolParams,
  ToolResult
> {
  constructor(
    private readonly config: Config,
    params: SlackCanvasCreateToolParams,
  ) {
    super(params);
  }

  getDescription(): string {
    const title = this.params.title?.slice(0, 80) || 'Untitled';
    return `Create Slack Canvas: "${title}" in channel ${this.params.channel_id}`;
  }

  async execute(signal: AbortSignal): Promise<ToolResult> {
    const token = process.env.SLACK_BOT_TOKEN;
    if (!token) {
      const msg =
        'Missing SLACK_BOT_TOKEN environment variable. Please set your Slack bot token.';
      return {
        llmContent: `Error: ${msg}`,
        returnDisplay: msg,
        error: { message: msg },
      };
    }

    const proxy = this.config.getProxy();
    const client = new SlackApiClient(token, proxy);

    try {
      console.log(
        `[SlackCanvas] Creating channel canvas in channel: ${this.params.channel_id}`,
      );

      // Create channel canvas using conversations.canvases.create
      const body = {
        channel_id: this.params.channel_id,
        title: this.params.title,
        document_content: {
          type: 'markdown',
          markdown: this.params.content_markdown,
        },
      };

      const res = await client.call(
        'conversations.canvases.create',
        body,
        signal,
      );

      console.log('[SlackCanvas] API response:', {
        ok: res.ok,
        canvas_id: res.canvas_id,
        error: res.error,
        warning: res.warning,
      });

      if (!res.ok) {
        const err = res.error || 'unknown_error';
        let errorMsg = `Slack API error creating canvas: ${err}`;

        // Provide specific error guidance
        if (err === 'missing_scope') {
          errorMsg += '. Missing required OAuth scope: canvases:write';
        } else if (err === 'not_allowed' || err === 'paid_only') {
          errorMsg +=
            '. Canvas creation requires a paid Slack workspace. Free workspaces do not support canvases.';
        } else if (err === 'feature_not_enabled') {
          errorMsg += '. Canvas feature is not enabled for this workspace.';
        } else if (err === 'channel_not_found') {
          errorMsg += '. Channel not found. Verify the channel_id is correct.';
        } else if (err === 'not_in_channel') {
          errorMsg +=
            '. Bot is not a member of the specified channel. Add the bot to the channel first.';
        } else {
          errorMsg +=
            '. Ensure the bot has proper permissions and is added to the channel.';
        }

        return {
          llmContent: `Error: ${errorMsg}`,
          returnDisplay: errorMsg,
          error: { message: errorMsg },
        };
      }

      const canvasId = res.canvas_id;
      if (!canvasId) {
        const msg = 'Canvas creation succeeded but no canvas_id was returned.';
        return {
          llmContent: `Error: ${msg}`,
          returnDisplay: msg,
          error: { message: msg },
        };
      }

      // Construct the canvas URL using the correct format
      let canvasUrl: string | undefined;
      try {
        const teamInfo = await client.getTeamInfo(signal);
        console.log('[SlackCanvas] Team info for URL construction:', teamInfo);

        if (teamInfo.team_id) {
          if (teamInfo.team_domain) {
            // Use the correct URL format: https://workspace.slack.com/docs/team_id/canvas_id
            canvasUrl = `https://${teamInfo.team_domain}.slack.com/docs/${teamInfo.team_id}/${canvasId}`;
          } else {
            console.warn(
              '[SlackCanvas] Missing team_domain, cannot construct workspace-specific URL',
            );
            // Fallback: we could potentially extract domain from other sources or use a generic format
          }
        } else {
          console.warn(
            '[SlackCanvas] Missing team_id, cannot construct canvas URL',
          );
        }
      } catch (e) {
        console.warn('[SlackCanvas] Failed to construct canvas URL:', e);
      }

      const summary = `Successfully created canvas "${this.params.title}" (${canvasId}) in channel ${this.params.channel_id}${canvasUrl ? `. URL: ${canvasUrl}` : ''}`;
      console.log('[SlackCanvas] Summary:', summary);
      return {
        llmContent: summary,
        returnDisplay: summary,
      };
    } catch (e) {
      const msg = `Failed to create canvas: ${getErrorMessage(e)}`;
      return {
        llmContent: `Error: ${msg}`,
        returnDisplay: msg,
        error: { message: msg },
      };
    }
  }
}

class SlackCanvasAppendInvocation extends BaseToolInvocation<
  SlackCanvasAppendToolParams,
  ToolResult
> {
  constructor(
    private readonly config: Config,
    params: SlackCanvasAppendToolParams,
  ) {
    super(params);
  }

  getDescription(): string {
    return `Append content to Slack Canvas ${this.params.canvas_id}`;
  }

  async execute(signal: AbortSignal): Promise<ToolResult> {
    const token = process.env.SLACK_BOT_TOKEN;
    if (!token) {
      const msg =
        'Missing SLACK_BOT_TOKEN environment variable. Please set your Slack bot token.';
      return {
        llmContent: `Error: ${msg}`,
        returnDisplay: msg,
        error: { message: msg },
      };
    }

    const proxy = this.config.getProxy();
    const client = new SlackApiClient(token, proxy);

    try {
      console.log(
        `[SlackCanvas] Appending content to canvas: ${this.params.canvas_id}`,
      );

      const body = {
        canvas_id: this.params.canvas_id,
        changes: [
          {
            operation: 'insert_at_end',
            document_content: {
              type: 'markdown',
              markdown: this.params.content_markdown,
            },
          },
        ],
      };

      const res = await client.call('canvases.edit', body, signal);

      console.log('[SlackCanvas] Edit response:', {
        ok: res.ok,
        canvas_id: res.canvas_id,
        error: res.error,
      });

      if (!res.ok) {
        const err = res.error || 'unknown_error';
        let errorMsg = `Slack API error appending to canvas: ${err}`;

        // Provide specific error guidance
        if (err === 'missing_scope') {
          errorMsg += '. Missing required OAuth scope: canvases:write';
        } else if (err === 'canvas_not_found') {
          errorMsg += '. Canvas not found. Verify the canvas_id is correct.';
        } else if (err === 'not_allowed') {
          errorMsg += '. Not allowed to edit this canvas. Check permissions.';
        } else if (err === 'paid_only') {
          errorMsg += '. Canvas editing requires a paid Slack workspace.';
        } else {
          errorMsg +=
            '. Ensure the bot has proper permissions to edit this canvas.';
        }

        return {
          llmContent: `Error: ${errorMsg}`,
          returnDisplay: errorMsg,
          error: { message: errorMsg },
        };
      }

      // Construct the canvas URL
      let canvasUrl: string | undefined;
      try {
        const teamInfo = await client.getTeamInfo(signal);
        console.log(
          '[SlackCanvas] Team info for URL construction (append):',
          teamInfo,
        );

        if (teamInfo.team_id) {
          if (teamInfo.team_domain) {
            canvasUrl = `https://${teamInfo.team_domain}.slack.com/docs/${teamInfo.team_id}/${this.params.canvas_id}`;
          } else {
            console.warn(
              '[SlackCanvas] Missing team_domain, cannot construct workspace-specific URL',
            );
          }
        } else {
          console.warn(
            '[SlackCanvas] Missing team_id, cannot construct canvas URL',
          );
        }
      } catch (e) {
        console.warn('[SlackCanvas] Failed to construct canvas URL:', e);
      }

      const summary = `Successfully appended content to canvas ${this.params.canvas_id}${canvasUrl ? `. URL: ${canvasUrl}` : ''}`;

      return {
        llmContent: summary,
        returnDisplay: summary,
      };
    } catch (e) {
      const msg = `Failed to append to canvas: ${getErrorMessage(e)}`;
      return {
        llmContent: `Error: ${msg}`,
        returnDisplay: msg,
        error: { message: msg },
      };
    }
  }
}

export class SlackCanvasCreateTool extends BaseDeclarativeTool<
  SlackCanvasCreateToolParams,
  ToolResult
> {
  static readonly Name: string = 'slack_canvas_create';

  constructor(private readonly config: Config) {
    super(
      SlackCanvasCreateTool.Name,
      'SlackCanvasCreate',
      'Creates a new Slack Canvas within a specified channel. The canvas will be accessible to all channel members. Always share the returned canvas URL with the user so they can access the canvas directly.',
      Kind.Other,
      {
        type: 'object',
        properties: {
          channel_id: {
            type: 'string',
            description:
              'Slack channel ID where the canvas will be created (e.g., C09CE4L2AJY)',
          },
          title: {
            type: 'string',
            description: 'Title for the new canvas',
          },
          content_markdown: {
            type: 'string',
            description: 'Initial Markdown content for the canvas',
          },
        },
        required: ['channel_id', 'title', 'content_markdown'],
      },
    );
  }

  protected override validateToolParams(
    params: SlackCanvasCreateToolParams,
  ): string | null {
    const errors = SchemaValidator.validate(
      this.schema.parametersJsonSchema,
      params,
    );
    if (errors) return errors;

    if (!params.channel_id?.trim()) return 'Missing or empty "channel_id"';
    if (!params.title?.trim()) return 'Missing or empty "title"';
    if (!params.content_markdown?.trim())
      return 'Missing or empty "content_markdown"';

    return null;
  }

  protected createInvocation(
    params: SlackCanvasCreateToolParams,
  ): ToolInvocation<SlackCanvasCreateToolParams, ToolResult> {
    return new SlackCanvasCreateInvocation(this.config, params);
  }
}

export class SlackCanvasAppendTool extends BaseDeclarativeTool<
  SlackCanvasAppendToolParams,
  ToolResult
> {
  static readonly Name: string = 'slack_canvas_append';

  constructor(private readonly config: Config) {
    super(
      SlackCanvasAppendTool.Name,
      'SlackCanvasAppend',
      'Appends Markdown content to an existing Slack Canvas. Always share the returned canvas URL with the user so they can access the updated canvas directly.',
      Kind.Other,
      {
        type: 'object',
        properties: {
          canvas_id: {
            type: 'string',
            description: 'Canvas ID to append content to (e.g., F09CX8BNCUU)',
          },
          content_markdown: {
            type: 'string',
            description: 'Markdown content to append to the canvas',
          },
        },
        required: ['canvas_id', 'content_markdown'],
      },
    );
  }

  protected override validateToolParams(
    params: SlackCanvasAppendToolParams,
  ): string | null {
    const errors = SchemaValidator.validate(
      this.schema.parametersJsonSchema,
      params,
    );
    if (errors) return errors;

    if (!params.canvas_id?.trim()) return 'Missing or empty "canvas_id"';
    if (!params.content_markdown?.trim())
      return 'Missing or empty "content_markdown"';

    return null;
  }

  protected createInvocation(
    params: SlackCanvasAppendToolParams,
  ): ToolInvocation<SlackCanvasAppendToolParams, ToolResult> {
    return new SlackCanvasAppendInvocation(this.config, params);
  }
}
