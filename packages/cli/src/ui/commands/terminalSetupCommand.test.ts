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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { terminalSetupCommand } from './terminalSetupCommand.js';
import * as terminalSetupModule from '../utils/terminalSetup.js';
import type { CommandContext } from './types.js';

vi.mock('../utils/terminalSetup.js');

describe('terminalSetupCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct metadata', () => {
    expect(terminalSetupCommand.name).toBe('terminal-setup');
    expect(terminalSetupCommand.description).toContain('multiline input');
    expect(terminalSetupCommand.kind).toBe('built-in');
  });

  it('should return success message when terminal setup succeeds', async () => {
    vi.spyOn(terminalSetupModule, 'terminalSetup').mockResolvedValue({
      success: true,
      message: 'Terminal configured successfully',
    });

    const result = await terminalSetupCommand.action({} as CommandContext, '');

    expect(result).toEqual({
      type: 'message',
      content: 'Terminal configured successfully',
      messageType: 'info',
    });
  });

  it('should append restart message when terminal setup requires restart', async () => {
    vi.spyOn(terminalSetupModule, 'terminalSetup').mockResolvedValue({
      success: true,
      message: 'Terminal configured successfully',
      requiresRestart: true,
    });

    const result = await terminalSetupCommand.action({} as CommandContext, '');

    expect(result).toEqual({
      type: 'message',
      content:
        'Terminal configured successfully\n\nPlease restart your terminal for the changes to take effect.',
      messageType: 'info',
    });
  });

  it('should return error message when terminal setup fails', async () => {
    vi.spyOn(terminalSetupModule, 'terminalSetup').mockResolvedValue({
      success: false,
      message: 'Failed to detect terminal',
    });

    const result = await terminalSetupCommand.action({} as CommandContext, '');

    expect(result).toEqual({
      type: 'message',
      content: 'Failed to detect terminal',
      messageType: 'error',
    });
  });

  it('should handle exceptions from terminal setup', async () => {
    vi.spyOn(terminalSetupModule, 'terminalSetup').mockRejectedValue(
      new Error('Unexpected error'),
    );

    const result = await terminalSetupCommand.action({} as CommandContext, '');

    expect(result).toEqual({
      type: 'message',
      content: 'Failed to configure terminal: Error: Unexpected error',
      messageType: 'error',
    });
  });
});
