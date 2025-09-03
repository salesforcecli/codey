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

import { describe, it, expect, vi } from 'vitest';
import {
  TestRig,
  createToolCallErrorMessage,
  printDebugInfo,
  validateModelOutput,
} from './test-helper.js';

describe('write_file', () => {
  it('should be able to write a file', async () => {
    const rig = new TestRig();
    await rig.setup('should be able to write a file');
    const prompt = `show me an example of using the write tool. put a dad joke in dad.txt`;

    const result = await rig.run(prompt);

    const foundToolCall = await rig.waitForToolCall('write_file');

    // Add debugging information
    if (!foundToolCall) {
      printDebugInfo(rig, result);
    }

    const allTools = rig.readToolLogs();
    expect(foundToolCall, 'Expected to find a write_file tool call').toBeTruthy(
      createToolCallErrorMessage(
        'write_file',
        allTools.map((t) => t.toolRequest.name),
        result,
      ),
    );

    // Validate model output - will throw if no output, warn if missing expected content
    validateModelOutput(result, 'dad.txt', 'Write file test');

    const newFilePath = 'dad.txt';

    const newFileContent = rig.readFile(newFilePath);

    // Add debugging for file content
    if (newFileContent === '') {
      console.error('File was created but is empty');
      console.error(
        'Tool calls:',
        rig.readToolLogs().map((t) => ({
          name: t.toolRequest.name,
          args: t.toolRequest.args,
        })),
      );
    }

    expect(newFileContent).not.toBe('');

    // Log success info if verbose
    vi.stubEnv('VERBOSE', 'true');
    if (process.env['VERBOSE'] === 'true') {
      console.log(
        'File created successfully with content:',
        newFileContent.substring(0, 100) + '...',
      );
    }
  });
});
