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

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as child_process from 'node:child_process';

vi.mock('node:child_process');

// Mock config modules
vi.mock('./config/settings.js', () => ({
  loadSettings: vi.fn(),
}));

vi.mock('./config/extension.js', () => ({
  loadExtensions: vi.fn(),
}));

vi.mock('./config/config.js', () => ({
  loadCliConfig: vi.fn(),
}));

// Mock @salesforce/codey-core
vi.mock('@salesforce/codey-core', () => ({
  executeToolCall: vi.fn(),
  GeminiEventType: {
    Content: 'content',
    ToolCallRequest: 'tool_call_request',
    ToolCallResponse: 'tool_call_response',
  },
  ToolErrorType: {
    UNHANDLED_EXCEPTION: 'unhandled_exception',
    HANDLED_EXCEPTION: 'handled_exception',
  },
}));

import { loadSettings, type LoadedSettings } from './config/settings.js';
import { loadExtensions, type Extension } from './config/extension.js';
import { loadCliConfig } from './config/config.js';
import {
  executeToolCall,
  GeminiEventType,
  ToolErrorType,
  type Config,
  type GeminiClient,
  type ServerGeminiStreamEvent,
  type AuthType,
} from '@salesforce/codey-core';

import {
  initClient,
  sendMessage,
  sendMessageStreaming,
} from './headless-chat.js';

// Mock implementations
const mockExecSync = vi.mocked(child_process.execSync);
const mockLoadSettings = vi.mocked(loadSettings);
const mockLoadExtensions = vi.mocked(loadExtensions);
const mockLoadCliConfig = vi.mocked(loadCliConfig);
const mockExecuteToolCall = vi.mocked(executeToolCall);

// Mock objects
const mockConfig = {
  initialize: vi.fn().mockResolvedValue(undefined),
  refreshAuth: vi.fn().mockResolvedValue(undefined),
  getGeminiClient: vi.fn(),
} as unknown as Config;

const mockGeminiClient = {
  sendMessageStream: vi.fn(),
} as unknown as GeminiClient;

describe('headless-chat', () => {
  const testWorkspaceRoot = '/test/workspace';
  const testSessionId = 'test-session-123';
  const testAuth = 'test-auth' as AuthType;

  beforeEach(() => {
    vi.resetAllMocks();

    // Setup default mock implementations
    mockExecSync.mockImplementation(() => Buffer.from('')); // Default success behavior for git commands
    mockLoadSettings.mockReturnValue({
      merged: {},
      system: { path: '', settings: {} },
      systemDefaults: { path: '', settings: {} },
      user: { path: '', settings: {} },
      workspace: { path: '', settings: {} },
      errors: [],
      isTrusted: true,
      migratedInMemorScopes: new Set(),
      forScope: vi.fn(),
      setValue: vi.fn(),
    } as unknown as LoadedSettings);
    mockLoadExtensions.mockReturnValue([]);
    mockLoadCliConfig.mockResolvedValue(mockConfig);
    vi.mocked(mockConfig.initialize).mockResolvedValue(undefined);
    vi.mocked(mockConfig.refreshAuth).mockResolvedValue(undefined);
    vi.mocked(mockConfig.getGeminiClient).mockReturnValue(mockGeminiClient);
    mockExecuteToolCall.mockResolvedValue({
      callId: 'test-call',
      responseParts: [{ text: 'tool response' }],
      resultDisplay: undefined,
      error: undefined,
      errorType: undefined,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initClient', () => {
    describe('git operations', () => {
      it('should checkout existing branch successfully', async () => {
        mockExecSync.mockImplementation(() => Buffer.from(''));

        const result = await initClient(
          testWorkspaceRoot,
          testSessionId,
          testAuth,
        );

        expect(mockExecSync).toHaveBeenCalledWith(
          `git checkout codey/${testSessionId}`,
          {
            cwd: testWorkspaceRoot,
            stdio: 'inherit',
          },
        );
        expect(result.config).toBe(mockConfig);
        expect(result.client).toBe(mockGeminiClient);
      });

      it('should create new branch when checkout fails', async () => {
        mockExecSync
          .mockImplementationOnce(() => {
            throw new Error('Branch does not exist');
          })
          .mockImplementation(() => Buffer.from(''));

        const result = await initClient(
          testWorkspaceRoot,
          testSessionId,
          testAuth,
        );

        expect(mockExecSync).toHaveBeenCalledWith(
          `git checkout codey/${testSessionId}`,
          expect.any(Object),
        );
        expect(mockExecSync).toHaveBeenCalledWith(`git reset --hard HEAD`, {
          cwd: testWorkspaceRoot,
          stdio: 'inherit',
        });
        expect(mockExecSync).toHaveBeenCalledWith(`git clean -fd`, {
          cwd: testWorkspaceRoot,
          stdio: 'inherit',
        });
        expect(mockExecSync).toHaveBeenCalledWith(`git checkout main`, {
          cwd: testWorkspaceRoot,
          stdio: 'inherit',
        });
        expect(mockExecSync).toHaveBeenCalledWith(
          `git checkout -b codey/${testSessionId}`,
          {
            cwd: testWorkspaceRoot,
            stdio: 'inherit',
          },
        );
        expect(result.config).toBe(mockConfig);
        expect(result.client).toBe(mockGeminiClient);
      });

      it('should throw error when branch creation fails', async () => {
        mockExecSync
          .mockImplementationOnce(() => {
            throw new Error('Branch does not exist');
          })
          .mockImplementationOnce(() => Buffer.from('')) // reset --hard
          .mockImplementationOnce(() => Buffer.from('')) // clean -fd
          .mockImplementationOnce(() => Buffer.from('')) // checkout main
          .mockImplementationOnce(() => {
            throw new Error('Failed to create branch');
          });

        await expect(
          initClient(testWorkspaceRoot, testSessionId, testAuth),
        ).rejects.toThrow(
          `Failed to checkout or create branch codey/${testSessionId}: Error: Failed to create branch`,
        );
      });

      it('should throw error when reset --hard fails during branch creation', async () => {
        mockExecSync
          .mockImplementationOnce(() => {
            throw new Error('Branch does not exist');
          })
          .mockImplementationOnce(() => {
            throw new Error('Reset failed');
          });

        await expect(
          initClient(testWorkspaceRoot, testSessionId, testAuth),
        ).rejects.toThrow(
          `Failed to checkout or create branch codey/${testSessionId}: Error: Reset failed`,
        );
      });
    });

    describe('configuration', () => {
      it('should load settings, extensions, and config correctly', async () => {
        mockExecSync.mockImplementation(() => Buffer.from(''));
        const testSettings = {
          merged: { test: 'value' },
          system: { path: '', settings: {} },
          systemDefaults: { path: '', settings: {} },
          user: { path: '', settings: {} },
          workspace: { path: '', settings: {} },
          errors: [],
          isTrusted: true,
          migratedInMemorScopes: new Set(),
          forScope: vi.fn(),
          setValue: vi.fn(),
        } as any;
        const testExtensions = [
          {
            path: '/test/path',
            config: { name: 'test-ext', version: '1.0.0' },
            contextFiles: [],
          },
        ] as Extension[];

        mockLoadSettings.mockReturnValue(testSettings);
        mockLoadExtensions.mockReturnValue(testExtensions);

        await initClient(testWorkspaceRoot, testSessionId, testAuth);

        expect(mockLoadSettings).toHaveBeenCalledWith(testWorkspaceRoot);
        expect(mockLoadExtensions).toHaveBeenCalledWith(testWorkspaceRoot);
        expect(mockLoadCliConfig).toHaveBeenCalledWith(
          testSettings.merged,
          testExtensions,
          testSessionId,
          expect.objectContaining({
            model: undefined,
            gatewayOrg: undefined,
            outputFormat: undefined,
            sandbox: undefined,
            sandboxImage: undefined,
            debug: false,
            prompt: undefined,
            promptInteractive: undefined,
            promptWords: undefined,
            allFiles: false,
            showMemoryUsage: false,
            yolo: true,
            approvalMode: undefined,
            telemetry: undefined,
            checkpointing: false,
            // telemetryTarget: undefined,
            // telemetryOtlpEndpoint: undefined,
            // telemetryOtlpProtocol: undefined,
            // telemetryLogPrompts: false,
            // telemetryOutfile: undefined,
            allowedMcpServerNames: undefined,
            allowedTools: undefined,
            experimentalAcp: false,
            extensions: [],
            listExtensions: false,
            proxy: undefined,
            includeDirectories: undefined,
            screenReader: false,
            useSmartEdit: false,
            useWriteTodos: undefined,
          }),
          testWorkspaceRoot,
        );
      });

      it('should merge custom options with defaults', async () => {
        mockExecSync.mockImplementation(() => Buffer.from(''));
        const customOpts = {
          model: 'custom-model',
          debug: true,
          yolo: false,
        };

        await initClient(
          testWorkspaceRoot,
          testSessionId,
          testAuth,
          customOpts,
        );

        expect(mockLoadCliConfig).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Array),
          testSessionId,
          expect.objectContaining({
            model: 'custom-model',
            debug: true,
            yolo: false,
          }),
          testWorkspaceRoot,
        );
      });

      it('should initialize config and refresh auth', async () => {
        mockExecSync.mockImplementation(() => Buffer.from(''));

        await initClient(testWorkspaceRoot, testSessionId, testAuth);

        expect(mockConfig.initialize).toHaveBeenCalledTimes(1);
        expect(mockConfig.refreshAuth).toHaveBeenCalledWith(testAuth);
        expect(mockConfig.getGeminiClient).toHaveBeenCalledTimes(1);
      });
    });

    describe('error scenarios', () => {
      it('should throw error when config initialization fails', async () => {
        mockExecSync.mockImplementation(() => Buffer.from(''));
        vi.mocked(mockConfig.initialize).mockRejectedValue(
          new Error('Config init failed'),
        );

        await expect(
          initClient(testWorkspaceRoot, testSessionId, testAuth),
        ).rejects.toThrow('Config init failed');
      });

      it('should throw error when auth refresh fails', async () => {
        mockExecSync.mockImplementation(() => Buffer.from(''));
        vi.mocked(mockConfig.refreshAuth).mockRejectedValue(
          new Error('Auth failed'),
        );

        await expect(
          initClient(testWorkspaceRoot, testSessionId, testAuth),
        ).rejects.toThrow('Auth failed');
      });
    });
  });

  describe('tool execution integration', () => {
    it('should execute tool calls through sendMessage flow', async () => {
      const testMessage = 'Use a tool please';

      // Mock the async generator that includes tool calls
      const mockStream = (async function* () {
        yield {
          type: GeminiEventType.Content,
          value: 'I will use a tool.',
        };
        yield {
          type: GeminiEventType.ToolCallRequest,
          value: {
            callId: 'call-1',
            name: 'test_tool',
            args: { param: 'value' },
          },
        };
      })() as AsyncGenerator<any, any, any>;

      vi.mocked(mockGeminiClient.sendMessageStream).mockReturnValue(
        mockStream as any,
      );

      await sendMessage(mockGeminiClient, mockConfig, testMessage);

      expect(mockExecuteToolCall).toHaveBeenCalledWith(
        mockConfig,
        {
          callId: 'call-1',
          name: 'test_tool',
          args: { param: 'value' },
          isClientInitiated: false,
          prompt_id: expect.any(String),
        },
        expect.any(AbortSignal),
      );
    });

    it('should handle tool execution errors', async () => {
      const testMessage = 'Use a failing tool';

      const mockStream = (async function* () {
        yield {
          type: GeminiEventType.ToolCallRequest,
          value: {
            callId: 'call-fail',
            name: 'failing_tool',
            args: {},
          },
        };
      })() as AsyncGenerator<any, any, any>;

      vi.mocked(mockGeminiClient.sendMessageStream).mockReturnValue(
        mockStream as any,
      );
      mockExecuteToolCall.mockResolvedValue({
        callId: 'call-fail',
        responseParts: [],
        resultDisplay: undefined,
        error: { name: 'ToolError', message: 'Tool failed' },
        errorType: ToolErrorType.UNHANDLED_EXCEPTION,
      });

      await expect(
        sendMessage(mockGeminiClient, mockConfig, testMessage),
      ).rejects.toThrow('Tool execution failed: Tool failed');
    });

    it('should handle multiple tool calls in sequence', async () => {
      const testMessage = 'Use multiple tools';

      const mockStream = (async function* () {
        yield {
          type: GeminiEventType.ToolCallRequest,
          value: {
            callId: 'call-1',
            name: 'tool1',
            args: { param1: 'value1' },
          },
        };
        yield {
          type: GeminiEventType.ToolCallRequest,
          value: {
            callId: 'call-2',
            name: 'tool2',
            args: { param2: 'value2' },
          },
        };
      })() as AsyncGenerator<any, any, any>;

      vi.mocked(mockGeminiClient.sendMessageStream).mockReturnValue(
        mockStream as any,
      );
      mockExecuteToolCall
        .mockResolvedValueOnce({
          callId: 'call-1',
          responseParts: [{ text: 'response1' }],
          resultDisplay: undefined,
          error: undefined,
          errorType: undefined,
        })
        .mockResolvedValueOnce({
          callId: 'call-2',
          responseParts: [{ text: 'response2' }],
          resultDisplay: undefined,
          error: undefined,
          errorType: undefined,
        });

      await sendMessage(mockGeminiClient, mockConfig, testMessage);

      expect(mockExecuteToolCall).toHaveBeenCalledTimes(2);
      expect(mockExecuteToolCall).toHaveBeenNthCalledWith(
        1,
        mockConfig,
        expect.objectContaining({
          callId: 'call-1',
          name: 'tool1',
        }),
        expect.any(AbortSignal),
      );
      expect(mockExecuteToolCall).toHaveBeenNthCalledWith(
        2,
        mockConfig,
        expect.objectContaining({
          callId: 'call-2',
          name: 'tool2',
        }),
        expect.any(AbortSignal),
      );
    });
  });

  describe('sendMessage', () => {
    it('should send message and return response with events', async () => {
      const testMessage = 'Hello, world!';
      const mockEvents: ServerGeminiStreamEvent[] = [
        { type: GeminiEventType.Content, value: 'Hello!' },
      ];

      // Mock the async generator that terminates after yielding content
      const mockStream = (async function* () {
        yield mockEvents[0];
        return; // Explicitly terminate the generator
      })() as AsyncGenerator<any, any, any>;

      vi.mocked(mockGeminiClient.sendMessageStream).mockReturnValue(
        mockStream as any,
      );

      const result = await sendMessage(
        mockGeminiClient,
        mockConfig,
        testMessage,
      );

      expect(result.response).toBe('Hello!');
      expect(result.events).toEqual(mockEvents);
      expect(result.turnCount).toBe(1);
    });

    it('should handle messages that trigger tool calls', async () => {
      const testMessage = 'Use a tool please';

      // First call: initial response with tool call
      const mockStream1 = (async function* () {
        yield {
          type: GeminiEventType.Content,
          value: 'I will use a tool.',
        };
        yield {
          type: GeminiEventType.ToolCallRequest,
          value: {
            callId: 'call-1',
            name: 'test_tool',
            args: { param: 'value' },
          },
        };
      })();

      // Second call: final response after tool execution (no more tool calls)
      const mockStream2 = (async function* () {
        yield {
          type: GeminiEventType.Content,
          value: ' Tool completed successfully.',
        };
        return; // Terminate to break the loop
      })();

      vi.mocked(mockGeminiClient.sendMessageStream)
        .mockReturnValueOnce(mockStream1 as any)
        .mockReturnValueOnce(mockStream2 as any);

      const result = await sendMessage(
        mockGeminiClient,
        mockConfig,
        testMessage,
      );

      expect(result.response).toBe(
        'I will use a tool. Tool completed successfully.',
      );
      expect(result.turnCount).toBe(2);
    });

    it('should handle maximum turns limit', async () => {
      const testMessage = 'Start loop that hits max turns';

      // Create a mock that returns tool calls for each turn until max turns
      let callCount = 0;
      vi.mocked(mockGeminiClient.sendMessageStream).mockImplementation((() => {
        callCount++;
        return (async function* () {
          yield {
            type: GeminiEventType.ToolCallRequest,
            value: {
              callId: `call-${callCount}`,
              name: 'looping_tool',
              args: {},
            },
          };
        })() as AsyncGenerator<any, any, any>;
      }) as any);

      mockExecuteToolCall.mockResolvedValue({
        callId: 'loop-call',
        responseParts: [{ text: 'continuing...' }],
        resultDisplay: undefined,
        error: undefined,
        errorType: undefined,
      });

      await expect(
        sendMessage(mockGeminiClient, mockConfig, testMessage),
      ).rejects.toThrow('Maximum turns exceeded');

      // Should have hit the max turns limit (50)
      expect(callCount).toBe(50);
    });
  });

  describe('sendMessageStreaming', () => {
    it('should stream events to callback and send completion event', async () => {
      const testMessage = 'Hello, streaming!';
      const onEvent = vi.fn();

      const mockEvents: ServerGeminiStreamEvent[] = [
        { type: GeminiEventType.Content, value: 'Hello!' },
        { type: GeminiEventType.Content, value: ' World!' },
      ];

      const mockStream = (async function* () {
        for (const event of mockEvents) {
          yield event;
        }
        return; // Explicitly terminate
      })() as AsyncGenerator<any, any, any>;

      vi.mocked(mockGeminiClient.sendMessageStream).mockReturnValue(
        mockStream as any,
      );

      const result = await sendMessageStreaming(
        mockGeminiClient,
        mockConfig,
        testMessage,
        onEvent,
      );

      expect(result.response).toBe('Hello! World!');
      expect(result.turnCount).toBe(1);

      // Check that all events were streamed
      expect(onEvent).toHaveBeenCalledTimes(3); // 2 content events + 1 completion
      expect(onEvent).toHaveBeenNthCalledWith(1, mockEvents[0]);
      expect(onEvent).toHaveBeenNthCalledWith(2, mockEvents[1]);
      expect(onEvent).toHaveBeenNthCalledWith(3, {
        type: 'stream_completed',
        value: 'COMPLETED',
      });
    });

    it('should handle abort signal during streaming', async () => {
      const testMessage = 'Test abort';
      const onEvent = vi.fn();

      // Mock the stream to throw an abort error
      vi.mocked(mockGeminiClient.sendMessageStream).mockImplementation((() => {
        throw new Error('Operation cancelled');
      }) as any);

      await expect(
        sendMessageStreaming(
          mockGeminiClient,
          mockConfig,
          testMessage,
          onEvent,
        ),
      ).rejects.toThrow('Operation cancelled');
    });

    it('should handle streaming with tool calls', async () => {
      const testMessage = 'Use tool streaming';
      const onEvent = vi.fn();

      // First stream: content + tool request
      const mockStream1 = (async function* () {
        yield { type: GeminiEventType.Content, value: 'Using tool...' };
        yield {
          type: GeminiEventType.ToolCallRequest,
          value: {
            callId: 'stream-call-1',
            name: 'stream_tool',
            args: { param: 'stream_value' },
          },
        };
      })();

      // Second stream: final response after tool execution
      const mockStream2 = (async function* () {
        yield { type: GeminiEventType.Content, value: ' Done!' };
        return;
      })();

      vi.mocked(mockGeminiClient.sendMessageStream)
        .mockReturnValueOnce(mockStream1 as any)
        .mockReturnValueOnce(mockStream2 as any);

      const result = await sendMessageStreaming(
        mockGeminiClient,
        mockConfig,
        testMessage,
        onEvent,
      );

      expect(result.response).toBe('Using tool... Done!');
      expect(onEvent).toHaveBeenCalledWith({
        type: GeminiEventType.Content,
        value: 'Using tool...',
      });
      expect(onEvent).toHaveBeenCalledWith({
        type: GeminiEventType.ToolCallRequest,
        value: expect.objectContaining({
          name: 'stream_tool',
        }),
      });
    });
  });
});
