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

import { execSync } from 'node:child_process';
import { loadSettings } from './config/settings.js';
import { loadExtensions } from './config/extension.js';
import { type CliArgs, loadCliConfig } from './config/config.js';
import {
  type AuthType,
  type Config,
  executeToolCall,
  type GeminiClient,
  GeminiEventType,
  type ServerGeminiStreamEvent,
  type ToolCallRequestInfo,
  ToolErrorType,
} from '@salesforce/codey-core';
import { type Content, type FunctionCall, type Part } from '@google/genai';

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
      // Reset the main branch to the latest commit
      execSync(`git reset --hard HEAD`, {
        cwd: workspaceRoot,
        stdio: 'inherit',
      });
      // Clean the workspace
      execSync(`git clean -fd`, {
        cwd: workspaceRoot,
        stdio: 'inherit',
      });
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
      showMemoryUsage: false,
      yolo: true,
      approvalMode: undefined,
      telemetry: undefined,
      checkpointing: false,
      telemetryTarget: undefined,
      telemetryOtlpEndpoint: undefined,
      telemetryOtlpProtocol: undefined,
      telemetryLogPrompts: false,
      telemetryOutfile: undefined,
      allowedMcpServerNames: undefined,
      allowedTools: undefined,
      experimentalAcp: false,
      extensions: [],
      listExtensions: false,
      proxy: undefined,
      includeDirectories: undefined,
      screenReader: false,
      useSmartEdit: false,
      sessionSummary: undefined,
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
  onEvent?: (event: ServerGeminiStreamEvent) => void;
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
  promptId: string,
  abortController: AbortController,
  onEvent?: (event: ServerGeminiStreamEvent) => void,
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

    // Tool execution will be tracked via ServerGeminiStreamEvent.ToolCallRequest/Response
    const toolResponse = await executeToolCall(
      config,
      requestInfo,
      abortController.signal,
    );

    // Emit ToolCallResponse event after tool execution completes
    if (onEvent) {
      const responseEvent: ServerGeminiStreamEvent = {
        type: GeminiEventType.ToolCallResponse,
        value: {
          callId,
          responseParts: toolResponse.responseParts || [],
          resultDisplay: toolResponse.resultDisplay,
          error: toolResponse.error,
          errorType: toolResponse.errorType,
        },
      };
      onEvent(responseEvent);
    }

    if (toolResponse.error) {
      if (toolResponse.errorType === ToolErrorType.UNHANDLED_EXCEPTION) {
        const errorMessage = `Tool execution failed: ${toolResponse.error.message}`;
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
  const promptId = Math.random().toString(16).slice(2);
  const abortController = new AbortController();

  let currentMessages: Content[] = [
    { role: 'user', parts: [{ text: message }] },
  ];

  let finalResponseText = '';
  let turnCount = 0;
  const maxTurns = 50;
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
      if (collectEvents) {
        events.push(event);
      }

      // Emit ALL events to the comprehensive handler
      if (onEvent) {
        onEvent(event);
      }

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
    }

    finalResponseText += responseText;

    if (functionCalls.length > 0) {
      const toolResponseParts = await executeToolCalls(
        functionCalls,
        config,
        promptId,
        abortController,
        onEvent,
      );

      currentMessages = [{ role: 'user', parts: toolResponseParts }];
    } else {
      break;
    }
  }

  return {
    response: finalResponseText,
    events: collectEvents ? events : undefined,
    turnCount,
  };
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
  onEvent: (event: ServerGeminiStreamEvent) => void,
) {
  const result = await processMessage(client, config, message, {
    onEvent,
    collectEvents: false,
  });

  // Send final completion event to indicate stream is truly done
  const completionEvent = {
    type: 'stream_completed',
    value: 'COMPLETED',
  };
  onEvent(completionEvent as ServerGeminiStreamEvent);

  return {
    response: result.response,
    turnCount: result.turnCount,
  };
}
