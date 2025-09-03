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
import { TestRig, printDebugInfo, validateModelOutput } from './test-helper.js';

describe('read_many_files', () => {
  it('should be able to read multiple files', async () => {
    const rig = new TestRig();
    await rig.setup('should be able to read multiple files');
    rig.createFile('file1.txt', 'file 1 content');
    rig.createFile('file2.txt', 'file 2 content');

    const prompt = `Please use read_many_files to read file1.txt and file2.txt and show me what's in them`;

    const result = await rig.run(prompt);

    // Check for either read_many_files or multiple read_file calls
    const allTools = rig.readToolLogs();
    const readManyFilesCall = await rig.waitForToolCall('read_many_files');
    const readFileCalls = allTools.filter(
      (t) => t.toolRequest.name === 'read_file',
    );

    // Accept either read_many_files OR at least 2 read_file calls
    const foundValidPattern = readManyFilesCall || readFileCalls.length >= 2;

    // Add debugging information
    if (!foundValidPattern) {
      printDebugInfo(rig, result, {
        'read_many_files called': readManyFilesCall,
        'read_file calls': readFileCalls.length,
      });
    }

    expect(
      foundValidPattern,
      'Expected to find either read_many_files or multiple read_file tool calls',
    ).toBeTruthy();

    // Validate model output - will throw if no output, warn if missing expected content
    validateModelOutput(
      result,
      ['file 1 content', 'file 2 content'],
      'Read many files test',
    );
  });
});
