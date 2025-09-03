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

import { describe, it, expect, beforeEach } from 'vitest';
import { settingsCommand } from './settingsCommand.js';
import { type CommandContext } from './types.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';

describe('settingsCommand', () => {
  let mockContext: CommandContext;

  beforeEach(() => {
    mockContext = createMockCommandContext();
  });

  it('should return a dialog action to open the settings dialog', () => {
    if (!settingsCommand.action) {
      throw new Error('The settings command must have an action.');
    }
    const result = settingsCommand.action(mockContext, '');
    expect(result).toEqual({
      type: 'dialog',
      dialog: 'settings',
    });
  });

  it('should have the correct name and description', () => {
    expect(settingsCommand.name).toBe('settings');
    expect(settingsCommand.description).toBe(
      'View and edit Gemini CLI settings',
    );
  });
});
