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
import { privacyCommand } from './privacyCommand.js';
import { type CommandContext } from './types.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';

describe('privacyCommand', () => {
  let mockContext: CommandContext;

  beforeEach(() => {
    mockContext = createMockCommandContext();
  });

  it('should return a dialog action to open the privacy dialog', () => {
    // Ensure the command has an action to test.
    if (!privacyCommand.action) {
      throw new Error('The privacy command must have an action.');
    }

    const result = privacyCommand.action(mockContext, '');

    // Assert that the action returns the correct object to trigger the privacy dialog.
    expect(result).toEqual({
      type: 'dialog',
      dialog: 'privacy',
    });
  });

  it('should have the correct name and description', () => {
    expect(privacyCommand.name).toBe('privacy');
    expect(privacyCommand.description).toBe('display the privacy notice');
  });
});
