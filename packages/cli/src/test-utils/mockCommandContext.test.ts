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

import { vi, describe, it, expect } from 'vitest';
import { createMockCommandContext } from './mockCommandContext.js';

describe('createMockCommandContext', () => {
  it('should return a valid CommandContext object with default mocks', () => {
    const context = createMockCommandContext();

    // Just a few spot checks to ensure the structure is correct
    // and functions are mocks.
    expect(context).toBeDefined();
    expect(context.ui.addItem).toBeInstanceOf(Function);
    expect(vi.isMockFunction(context.ui.addItem)).toBe(true);
  });

  it('should apply top-level overrides correctly', () => {
    const mockClear = vi.fn();
    const overrides = {
      ui: {
        clear: mockClear,
      },
    };

    const context = createMockCommandContext(overrides);

    // Call the function to see if the override was used
    context.ui.clear();

    // Assert that our specific mock was called, not the default
    expect(mockClear).toHaveBeenCalled();
    // And that other defaults are still in place
    expect(vi.isMockFunction(context.ui.addItem)).toBe(true);
  });

  it('should apply deeply nested overrides correctly', () => {
    // This is the most important test for factory's logic.
    const mockConfig = {
      getProjectRoot: () => '/test/project',
      getModel: () => 'gemini-pro',
    };

    const overrides = {
      services: {
        config: mockConfig,
      },
    };

    const context = createMockCommandContext(overrides);

    expect(context.services.config).toBeDefined();
    expect(context.services.config?.getModel()).toBe('gemini-pro');
    expect(context.services.config?.getProjectRoot()).toBe('/test/project');

    // Verify a default property on the same nested object is still there
    expect(context.services.logger).toBeDefined();
  });
});
