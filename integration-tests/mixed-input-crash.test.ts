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
import { TestRig } from './test-helper.js';

describe('mixed input crash prevention', () => {
  it('should not crash when using mixed prompt inputs', async () => {
    const rig = new TestRig();
    rig.setup('should not crash when using mixed prompt inputs');

    // Test: echo "say '1'." | gemini --prompt-interactive="say '2'." say '3'.
    const stdinContent = "say '1'.";

    try {
      await rig.run(
        { stdin: stdinContent },
        '--prompt-interactive',
        "say '2'.",
        "say '3'.",
      );
      throw new Error('Expected the command to fail, but it succeeded');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(Error);
      const err = error as Error;

      expect(err.message).toContain('Process exited with code 1');
      expect(err.message).toContain(
        '--prompt-interactive flag cannot be used when input is piped',
      );
      expect(err.message).not.toContain('setRawMode is not a function');
      expect(err.message).not.toContain('unexpected critical error');
    }

    const lastRequest = rig.readLastApiRequest();
    expect(lastRequest).toBeNull();
  });

  it('should provide clear error message for mixed input', async () => {
    const rig = new TestRig();
    rig.setup('should provide clear error message for mixed input');

    try {
      await rig.run(
        { stdin: 'test input' },
        '--prompt-interactive',
        'test prompt',
      );
      throw new Error('Expected the command to fail, but it succeeded');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(Error);
      const err = error as Error;

      expect(err.message).toContain(
        '--prompt-interactive flag cannot be used when input is piped',
      );
    }
  });
});
