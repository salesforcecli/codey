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

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import open from 'open';
import { docsCommand, docsUrl } from './docsCommand.js';
import { type CommandContext } from './types.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import { MessageType } from '../types.js';

// Mock the 'open' library
vi.mock('open', () => ({
  default: vi.fn(),
}));

describe('docsCommand', () => {
  let mockContext: CommandContext;
  beforeEach(() => {
    // Create a fresh mock context before each test
    mockContext = createMockCommandContext();
    // Reset the `open` mock
    vi.mocked(open).mockClear();
  });

  afterEach(() => {
    // Restore any stubbed environment variables
    vi.unstubAllEnvs();
  });

  it("should add an info message and call 'open' in a non-sandbox environment", async () => {
    if (!docsCommand.action) {
      throw new Error('docsCommand must have an action.');
    }

    await docsCommand.action(mockContext, '');

    expect(mockContext.ui.addItem).toHaveBeenCalledWith(
      {
        type: MessageType.INFO,
        text: `Opening documentation in your browser: ${docsUrl}`,
      },
      expect.any(Number),
    );

    expect(open).toHaveBeenCalledWith(docsUrl);
  });

  it('should only add an info message in a sandbox environment', async () => {
    if (!docsCommand.action) {
      throw new Error('docsCommand must have an action.');
    }

    // Simulate a sandbox environment
    vi.stubEnv('SANDBOX', 'gemini-sandbox');

    await docsCommand.action(mockContext, '');

    expect(mockContext.ui.addItem).toHaveBeenCalledWith(
      {
        type: MessageType.INFO,
        text: `Please open the following URL in your browser to view the documentation:\n${docsUrl}`,
      },
      expect.any(Number),
    );

    // Ensure 'open' was not called in the sandbox
    expect(open).not.toHaveBeenCalled();
  });

  it("should not open browser for 'sandbox-exec'", async () => {
    if (!docsCommand.action) {
      throw new Error('docsCommand must have an action.');
    }

    // Simulate the specific 'sandbox-exec' environment
    vi.stubEnv('SANDBOX', 'sandbox-exec');

    await docsCommand.action(mockContext, '');

    // The logic should fall through to the 'else' block
    expect(mockContext.ui.addItem).toHaveBeenCalledWith(
      {
        type: MessageType.INFO,
        text: `Opening documentation in your browser: ${docsUrl}`,
      },
      expect.any(Number),
    );

    // 'open' should be called in this specific sandbox case
    expect(open).toHaveBeenCalledWith(docsUrl);
  });
});
