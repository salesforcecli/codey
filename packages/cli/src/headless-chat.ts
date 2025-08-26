/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { loadSettings } from './config/settings.js';
import { loadExtensions } from './config/extension.js';
import { CliArgs, loadCliConfig } from './config/config.js';
import {
  AuthType,
  Config,
  createContentGeneratorConfig,
  executeToolCall,
  GeminiClient,
  GeminiEventType,
  ToolCallRequestInfo,
  ToolErrorType,
} from '@google/gemini-cli-core';
import { Content, FunctionCall, Part } from '@google/genai';

export async function initClient(
  workspaceRoot: string,
  sessionId: string,
  auth: AuthType,
  opts?: Partial<CliArgs>,
) {
  const settings = loadSettings(workspaceRoot);
  const extensions = loadExtensions(workspaceRoot);
  const config = await loadCliConfig(settings.merged, extensions, sessionId, {
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
  });

  await config.initialize();
  const client = new GeminiClient(config);
  const contentGenCfg = createContentGeneratorConfig(config, auth);
  await client.initialize(contentGenCfg);

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
  const maxTurns = 10; // Prevent infinite loops

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
    turnCount,
  };
}
