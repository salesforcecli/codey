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

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { corgiCommand } from './corgiCommand.js';
import { type CommandContext } from './types.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';

describe('corgiCommand', () => {
  let mockContext: CommandContext;

  beforeEach(() => {
    mockContext = createMockCommandContext();
    vi.spyOn(mockContext.ui, 'toggleCorgiMode');
  });

  it('should call the toggleCorgiMode function on the UI context', async () => {
    if (!corgiCommand.action) {
      throw new Error('The corgi command must have an action.');
    }

    await corgiCommand.action(mockContext, '');

    expect(mockContext.ui.toggleCorgiMode).toHaveBeenCalledTimes(1);
  });

  it('should have the correct name and description', () => {
    expect(corgiCommand.name).toBe('corgi');
    expect(corgiCommand.description).toBe('Toggles corgi mode.');
  });
});
