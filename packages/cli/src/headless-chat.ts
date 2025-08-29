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

export async function sendMessage(
  client: GeminiClient,
  config: Config,
  message: string,
) {
  const toolRegistry = await config.getToolRegistry();
  const promptId = Math.random().toString(16).slice(2);
  const abortController = new AbortController();

  // Process the message using the agentic loop with tool execution
  let currentMessages: Content[] = [
    { role: 'user', parts: [{ text: message }] },
  ];

  let finalResponseText = '';
  let turnCount = 0;
  const maxTurns = 50; // Prevent infinite loops
  const events: ServerGeminiStreamEvent[] = [];
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
      events.push(event);
      if (abortController.signal.aborted) {
        throw new Error('Operation cancelled');
      }

      if (event.type === GeminiEventType.Content) {
        responseText += event.value;
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

    // Store the response text from this turn
    finalResponseText += responseText;

    if (functionCalls.length > 0) {
      // Execute tool calls and continue the conversation
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

        const toolResponse = await executeToolCall(
          config,
          requestInfo,
          toolRegistry,
          abortController.signal,
        );

        if (toolResponse.error) {
          if (toolResponse.errorType === ToolErrorType.UNHANDLED_EXCEPTION) {
            throw new Error(
              `Tool execution failed: ${toolResponse.error.message}`,
            );
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
      }

      // Continue conversation with tool responses
      currentMessages = [{ role: 'user', parts: toolResponseParts }];
    } else {
      // No more tool calls, conversation is complete
      break;
    }
  }

  return {
    response: finalResponseText,
    events,
    turnCount,
  };
}

// for production implementation, we need to DRY this with sendMessage
// we also need to return ALL events and let the API layer decide
// which ones to send to the client
export async function sendMessageStreaming(
  client: GeminiClient,
  config: Config,
  message: string,
  onEvent: (event: StreamEvent) => void,
) {
  const toolRegistry = await config.getToolRegistry();
  const promptId = Math.random().toString(16).slice(2);
  const abortController = new AbortController();

  let currentMessages: Content[] = [
    { role: 'user', parts: [{ text: message }] },
  ];

  let finalResponseText = '';
  let turnCount = 0;
  const maxTurns = 50;

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
        if (abortController.signal.aborted) {
          throw new Error('Operation cancelled');
        }

        if (event.type === GeminiEventType.Content) {
          responseText += event.value;
          onEvent({ type: 'content', delta: event.value });
        } else if (event.type === GeminiEventType.ToolCallRequest) {
          const toolCallRequest = event.value;
          const fc: FunctionCall = {
            name: toolCallRequest.name,
            args: toolCallRequest.args,
            id: toolCallRequest.callId,
          };
          functionCalls.push(fc);
        }
        // Thoughts are intentionally not emitted
      }

      finalResponseText += responseText;

      if (functionCalls.length > 0) {
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

          onEvent({
            type: 'tool_start',
            name: requestInfo.name,
            args: requestInfo.args,
          });
          try {
            const toolResponse = await executeToolCall(
              config,
              requestInfo,
              toolRegistry,
              abortController.signal,
            );

            if (toolResponse.error) {
              if (
                toolResponse.errorType === ToolErrorType.UNHANDLED_EXCEPTION
              ) {
                onEvent({
                  type: 'tool_result',
                  name: requestInfo.name,
                  ok: false,
                  error: toolResponse.error.message,
                });
                throw new Error(
                  `Tool execution failed: ${toolResponse.error.message}`,
                );
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

            onEvent({ type: 'tool_result', name: requestInfo.name, ok: true });
          } catch (err: unknown) {
            const e = err as Error;
            onEvent({
              type: 'tool_result',
              name: requestInfo.name,
              ok: false,
              error: e?.message || String(e),
            });
            throw err;
          }
        }

        currentMessages = [{ role: 'user', parts: toolResponseParts }];
      } else {
        break;
      }
    }

    onEvent({ type: 'done', finalText: finalResponseText, turnCount });
    return { response: finalResponseText, turnCount };
  } catch (err: unknown) {
    const e = err as Error;
    onEvent({ type: 'error', message: e?.message || String(e) });
    throw err;
  }
}
