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
import { editorCommand } from './editorCommand.js';
// 1. Import the mock context utility
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';

describe('editorCommand', () => {
  it('should return a dialog action to open the editor dialog', () => {
    if (!editorCommand.action) {
      throw new Error('The editor command must have an action.');
    }
    const mockContext = createMockCommandContext();
    const result = editorCommand.action(mockContext, '');

    expect(result).toEqual({
      type: 'dialog',
      dialog: 'editor',
    });
  });

  it('should have the correct name and description', () => {
    expect(editorCommand.name).toBe('editor');
    expect(editorCommand.description).toBe('set external editor preference');
  });
});
