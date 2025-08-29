/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync } from 'child_process';
import { loadSettings } from './config/settings.js';
import { loadExtensions } from './config/extension.js';
import { CliArgs, loadCliConfig } from './config/config.js';
import {
  AuthType,
  Config,
  executeToolCall,
  GeminiClient,
  GeminiEventType,
  ServerGeminiStreamEvent,
  ToolCallRequestInfo,
  ToolErrorType,
} from '@google/gemini-cli-core';
import { Content, FunctionCall, Part } from '@google/genai';

export type StreamEvent =
  | { type: 'content'; delta: string }
  | { type: 'tool_start'; name: string; args?: Record<string, unknown> }
  | {
      type: 'tool_result';
      name: string;
      ok: boolean;
      error?: string;
    }
  | { type: 'done'; finalText: string; turnCount: number }
  | { type: 'error'; message: string };

export async function initClient(
  workspaceRoot: string,
  sessionId: string,
  auth: AuthType,
  opts?: Partial<CliArgs>,
) {
  // Checkout the session-specific branch before anything else
  try {
    execSync(`git checkout codey/${sessionId}`, {
      cwd: workspaceRoot,
      stdio: 'inherit',
    });
    console.log(`Checked out branch codey/${sessionId}`);
  } catch (_error) {
    // If the branch doesn't exist, create it from main
    try {
      // First checkout main to ensure we're creating the branch from main
      execSync(`git checkout main`, {
        cwd: workspaceRoot,
        stdio: 'inherit',
      });
      // Then create and checkout the new branch from main
      execSync(`git checkout -b codey/${sessionId}`, {
        cwd: workspaceRoot,
        stdio: 'inherit',
      });
      console.log(`Created and checked out branch codey/${sessionId}`);
    } catch (createError) {
      throw new Error(
        `Failed to checkout or create branch codey/${sessionId}: ${createError}`,
      );
    }
  }

  const settings = loadSettings(workspaceRoot);
  const extensions = loadExtensions(workspaceRoot);
  const config = await loadCliConfig(
    settings.merged,
    extensions,
    sessionId,
    {
      model: undefined,
      sandbox: undefined,
      sandboxImage: undefined,
      debug: false,
      prompt: undefined,
      promptInteractive: undefined,
      allFiles: false,
      all_files: false,
      showMemoryUsage: false,
      show_memory_usage: false,
      yolo: true,
      approvalMode: undefined,
      telemetry: undefined,
      checkpointing: false,
      telemetryTarget: undefined,
      telemetryOtlpEndpoint: undefined,
      telemetryLogPrompts: false,
      telemetryOutfile: undefined,
      allowedMcpServerNames: undefined,
      experimentalAcp: false,
      extensions: [],
      listExtensions: false,
      proxy: undefined,
      includeDirectories: undefined,
      ...opts,
    },
    workspaceRoot,
  );

  await config.initialize();
  await config.refreshAuth(auth);
  const client = config.getGeminiClient();

  return { config, client };
}

interface MessageProcessingOptions {
  onEvent?: (event: StreamEvent) => void;
  collectEvents?: boolean;
}

interface MessageProcessingResult {
  response: string;
  events?: ServerGeminiStreamEvent[];
  turnCount: number;
}

async function executeToolCalls(
  functionCalls: FunctionCall[],
  config: Config,
  toolRegistry: Awaited<ReturnType<Config['getToolRegistry']>>,
  promptId: string,
  abortController: AbortController,
  onEvent?: (event: StreamEvent) => void,
): Promise<Part[]> {
  const toolResponseParts: Part[] = [];

  for (const fc of functionCalls) {
    const callId = fc.id ?? `${fc.name}-${Date.now()}`;
    const requestInfo: ToolCallRequestInfo = {
      callId,
      name: fc.name as string,
      args: (fc.args ?? {}) as Record<string, unknown>,
      isClientInitiated: false,
      prompt_id: promptId,
    };

    if (onEvent) {
      onEvent({
        type: 'tool_start',
        name: requestInfo.name,
        args: requestInfo.args,
      });
    }

    try {
      const toolResponse = await executeToolCall(
        config,
        requestInfo,
        toolRegistry,
        abortController.signal,
      );

      if (toolResponse.error) {
        if (toolResponse.errorType === ToolErrorType.UNHANDLED_EXCEPTION) {
          const errorMessage = `Tool execution failed: ${toolResponse.error.message}`;
          if (onEvent) {
            onEvent({
              type: 'tool_result',
              name: requestInfo.name,
              ok: false,
              error: toolResponse.error.message,
            });
          }
          throw new Error(errorMessage);
        }
      }

      if (toolResponse.responseParts) {
        const parts = Array.isArray(toolResponse.responseParts)
          ? toolResponse.responseParts
          : [toolResponse.responseParts];
        for (const part of parts) {
          if (typeof part === 'string') {
            toolResponseParts.push({ text: part });
          } else if (part) {
            toolResponseParts.push(part);
          }
        }
      }

      if (onEvent) {
        onEvent({ type: 'tool_result', name: requestInfo.name, ok: true });
      }
    } catch (err: unknown) {
      const e = err as Error;
      if (onEvent) {
        onEvent({
          type: 'tool_result',
          name: requestInfo.name,
          ok: false,
          error: e?.message || String(e),
        });
      }
      throw err;
    }
  }

  return toolResponseParts;
}

async function processMessage(
  client: GeminiClient,
  config: Config,
  message: string,
  options: MessageProcessingOptions = {},
): Promise<MessageProcessingResult> {
  const { onEvent, collectEvents = false } = options;
  const toolRegistry = await config.getToolRegistry();
  const promptId = Math.random().toString(16).slice(2);
  const abortController = new AbortController();

  let currentMessages: Content[] = [
    { role: 'user', parts: [{ text: message }] },
  ];

  let finalResponseText = '';
  let turnCount = 0;
  const maxTurns = 50;
  const events: ServerGeminiStreamEvent[] = [];

  try {
    while (true) {
      turnCount++;
      if (turnCount > maxTurns) {
        throw new Error('Maximum turns exceeded');
      }

      const functionCalls: FunctionCall[] = [];
      let responseText = '';
      const responseStream = client.sendMessageStream(
        currentMessages[0]?.parts || [],
        abortController.signal,
        promptId,
      );

      for await (const event of responseStream) {
        if (collectEvents) {
          events.push(event);
        }

        if (abortController.signal.aborted) {
          throw new Error('Operation cancelled');
        }

        if (event.type === GeminiEventType.Content) {
          responseText += event.value;
          if (onEvent) {
            onEvent({ type: 'content', delta: event.value });
          }
        } else if (event.type === GeminiEventType.ToolCallRequest) {
          const toolCallRequest = event.value;
          const fc: FunctionCall = {
            name: toolCallRequest.name,
            args: toolCallRequest.args,
            id: toolCallRequest.callId,
          };
          functionCalls.push(fc);
        }
        // Note: GeminiEventType.Thought events are ignored (internal reasoning)
      }

      finalResponseText += responseText;

      if (functionCalls.length > 0) {
        const toolResponseParts = await executeToolCalls(
          functionCalls,
          config,
          toolRegistry,
          promptId,
          abortController,
          onEvent,
        );

        currentMessages = [{ role: 'user', parts: toolResponseParts }];
      } else {
        break;
      }
    }

    if (onEvent) {
      onEvent({ type: 'done', finalText: finalResponseText, turnCount });
    }

    return {
      response: finalResponseText,
      events: collectEvents ? events : undefined,
      turnCount,
    };
  } catch (err: unknown) {
    const e = err as Error;
    if (onEvent) {
      onEvent({ type: 'error', message: e?.message || String(e) });
    }
    throw err;
  }
}

export async function sendMessage(
  client: GeminiClient,
  config: Config,
  message: string,
) {
  const result = await processMessage(client, config, message, {
    collectEvents: true,
  });

  return {
    response: result.response,
    events: result.events!,
    turnCount: result.turnCount,
  };
}

export async function sendMessageStreaming(
  client: GeminiClient,
  config: Config,
  message: string,
  onEvent: (event: StreamEvent) => void,
) {
  const result = await processMessage(client, config, message, {
    onEvent,
    collectEvents: false,
  });

  return {
    response: result.response,
    turnCount: result.turnCount,
  };
}
