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

import type { MockInstance } from 'vitest';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ideCommand } from './ideCommand.js';
import { type CommandContext } from './types.js';
import { IDE_DEFINITIONS } from '@salesforce/codey-core';
import * as core from '@salesforce/codey-core';

vi.mock('@salesforce/codey-core', async (importOriginal) => {
  const original = await importOriginal<typeof core>();
  return {
    ...original,
    getOauthClient: vi.fn(original.getOauthClient),
    getIdeInstaller: vi.fn(original.getIdeInstaller),
    IdeClient: {
      getInstance: vi.fn(),
    },
  };
});

describe('ideCommand', () => {
  let mockContext: CommandContext;
  let mockIdeClient: core.IdeClient;
  let platformSpy: MockInstance;

  beforeEach(() => {
    vi.resetAllMocks();

    mockIdeClient = {
      reconnect: vi.fn(),
      disconnect: vi.fn(),
      connect: vi.fn(),
      getCurrentIde: vi.fn(),
      getConnectionStatus: vi.fn(),
      getDetectedIdeDisplayName: vi.fn(),
    } as unknown as core.IdeClient;

    vi.mocked(core.IdeClient.getInstance).mockResolvedValue(mockIdeClient);
    vi.mocked(mockIdeClient.getDetectedIdeDisplayName).mockReturnValue(
      'VS Code',
    );

    mockContext = {
      ui: {
        addItem: vi.fn(),
      },
      services: {
        settings: {
          setValue: vi.fn(),
        },
        config: {
          getIdeMode: vi.fn(),
          setIdeMode: vi.fn(),
          getUsageStatisticsEnabled: vi.fn().mockReturnValue(false),
        },
      },
    } as unknown as CommandContext;

    platformSpy = vi.spyOn(process, 'platform', 'get');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return the ide command', async () => {
    vi.mocked(mockIdeClient.getCurrentIde).mockReturnValue(
      IDE_DEFINITIONS.vscode,
    );
    vi.mocked(mockIdeClient.getConnectionStatus).mockReturnValue({
      status: core.IDEConnectionStatus.Disconnected,
    });
    const command = await ideCommand();
    expect(command).not.toBeNull();
    expect(command.name).toBe('ide');
    expect(command.subCommands).toHaveLength(3);
    expect(command.subCommands?.[0].name).toBe('enable');
    expect(command.subCommands?.[1].name).toBe('status');
    expect(command.subCommands?.[2].name).toBe('install');
  });

  it('should show disable command when connected', async () => {
    vi.mocked(mockIdeClient.getCurrentIde).mockReturnValue(
      IDE_DEFINITIONS.vscode,
    );
    vi.mocked(mockIdeClient.getConnectionStatus).mockReturnValue({
      status: core.IDEConnectionStatus.Connected,
    });
    const command = await ideCommand();
    expect(command).not.toBeNull();
    const subCommandNames = command.subCommands?.map((cmd) => cmd.name);
    expect(subCommandNames).toContain('disable');
    expect(subCommandNames).not.toContain('enable');
  });

  describe('status subcommand', () => {
    beforeEach(() => {
      vi.mocked(mockIdeClient.getCurrentIde).mockReturnValue(
        IDE_DEFINITIONS.vscode,
      );
    });

    it('should show connected status', async () => {
      vi.mocked(mockIdeClient.getConnectionStatus).mockReturnValue({
        status: core.IDEConnectionStatus.Connected,
      });
      const command = await ideCommand();
      const result = await command!.subCommands!.find(
        (c) => c.name === 'status',
      )!.action!(mockContext, '');
      expect(vi.mocked(mockIdeClient.getConnectionStatus)).toHaveBeenCalled();
      expect(result).toEqual({
        type: 'message',
        messageType: 'info',
        content: '🟢 Connected to VS Code',
      });
    });

    it('should show connecting status', async () => {
      vi.mocked(mockIdeClient.getConnectionStatus).mockReturnValue({
        status: core.IDEConnectionStatus.Connecting,
      });
      const command = await ideCommand();
      const result = await command!.subCommands!.find(
        (c) => c.name === 'status',
      )!.action!(mockContext, '');
      expect(vi.mocked(mockIdeClient.getConnectionStatus)).toHaveBeenCalled();
      expect(result).toEqual({
        type: 'message',
        messageType: 'info',
        content: `🟡 Connecting...`,
      });
    });
    it('should show disconnected status', async () => {
      vi.mocked(mockIdeClient.getConnectionStatus).mockReturnValue({
        status: core.IDEConnectionStatus.Disconnected,
      });
      const command = await ideCommand();
      const result = await command!.subCommands!.find(
        (c) => c.name === 'status',
      )!.action!(mockContext, '');
      expect(vi.mocked(mockIdeClient.getConnectionStatus)).toHaveBeenCalled();
      expect(result).toEqual({
        type: 'message',
        messageType: 'error',
        content: `🔴 Disconnected`,
      });
    });

    it('should show disconnected status with details', async () => {
      const details = 'Something went wrong';
      vi.mocked(mockIdeClient.getConnectionStatus).mockReturnValue({
        status: core.IDEConnectionStatus.Disconnected,
        details,
      });
      const command = await ideCommand();
      const result = await command!.subCommands!.find(
        (c) => c.name === 'status',
      )!.action!(mockContext, '');
      expect(vi.mocked(mockIdeClient.getConnectionStatus)).toHaveBeenCalled();
      expect(result).toEqual({
        type: 'message',
        messageType: 'error',
        content: `🔴 Disconnected: ${details}`,
      });
    });
  });

  describe('install subcommand', () => {
    const mockInstall = vi.fn();
    beforeEach(() => {
      vi.mocked(mockIdeClient.getCurrentIde).mockReturnValue(
        IDE_DEFINITIONS.vscode,
      );
      vi.mocked(mockIdeClient.getConnectionStatus).mockReturnValue({
        status: core.IDEConnectionStatus.Disconnected,
      });
      vi.mocked(core.getIdeInstaller).mockReturnValue({
        install: mockInstall,
      });
      platformSpy.mockReturnValue('linux');
    });

    it('should install the extension', async () => {
      vi.useFakeTimers();
      mockInstall.mockResolvedValue({
        success: true,
        message: 'Successfully installed.',
      });

      const command = await ideCommand();

      // For the polling loop inside the action.
      vi.mocked(mockIdeClient.getConnectionStatus).mockReturnValue({
        status: core.IDEConnectionStatus.Connected,
      });

      const actionPromise = command!.subCommands!.find(
        (c) => c.name === 'install',
      )!.action!(mockContext, '');
      await vi.runAllTimersAsync();
      await actionPromise;

      expect(core.getIdeInstaller).toHaveBeenCalledWith(IDE_DEFINITIONS.vscode);
      expect(mockInstall).toHaveBeenCalled();
      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'info',
          text: `Installing IDE companion...`,
        }),
        expect.any(Number),
      );
      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'info',
          text: 'Successfully installed.',
        }),
        expect.any(Number),
      );
      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'info',
          text: '🟢 Connected to VS Code',
        }),
        expect.any(Number),
      );
      vi.useRealTimers();
    }, 10000);

    it('should show an error if installation fails', async () => {
      mockInstall.mockResolvedValue({
        success: false,
        message: 'Installation failed.',
      });

      const command = await ideCommand();
      await command!.subCommands!.find((c) => c.name === 'install')!.action!(
        mockContext,
        '',
      );

      expect(core.getIdeInstaller).toHaveBeenCalledWith(IDE_DEFINITIONS.vscode);
      expect(mockInstall).toHaveBeenCalled();
      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'info',
          text: `Installing IDE companion...`,
        }),
        expect.any(Number),
      );
      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          text: 'Installation failed.',
        }),
        expect.any(Number),
      );
    });
  });
});
