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

import { describe, it, expect } from 'vitest';
import { extensionsCommand } from './extensionsCommand.js';
import { type CommandContext } from './types.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import { MessageType } from '../types.js';

describe('extensionsCommand', () => {
  let mockContext: CommandContext;

  it('should display "No active extensions." when none are found', async () => {
    mockContext = createMockCommandContext({
      services: {
        config: {
          getExtensions: () => [],
        },
      },
    });

    if (!extensionsCommand.action) throw new Error('Action not defined');
    await extensionsCommand.action(mockContext, '');

    expect(mockContext.ui.addItem).toHaveBeenCalledWith(
      {
        type: MessageType.INFO,
        text: 'No active extensions.',
      },
      expect.any(Number),
    );
  });

  it('should list active extensions when they are found', async () => {
    const mockExtensions = [
      { name: 'ext-one', version: '1.0.0', isActive: true },
      { name: 'ext-two', version: '2.1.0', isActive: true },
      { name: 'ext-three', version: '3.0.0', isActive: false },
    ];
    mockContext = createMockCommandContext({
      services: {
        config: {
          getExtensions: () => mockExtensions,
        },
      },
    });

    if (!extensionsCommand.action) throw new Error('Action not defined');
    await extensionsCommand.action(mockContext, '');

    const expectedMessage =
      'Active extensions:\n\n' +
      `  - \u001b[36mext-one (v1.0.0)\u001b[0m\n` +
      `  - \u001b[36mext-two (v2.1.0)\u001b[0m\n`;

    expect(mockContext.ui.addItem).toHaveBeenCalledWith(
      {
        type: MessageType.INFO,
        text: expectedMessage,
      },
      expect.any(Number),
    );
  });
});
