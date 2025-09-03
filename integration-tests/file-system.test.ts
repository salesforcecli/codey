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

describe('file-system', () => {
  it('should be able to read a file', async () => {
    const rig = new TestRig();
    await rig.setup('should be able to read a file');
    rig.createFile('test.txt', 'hello world');

    const result = await rig.run(
      `read the file test.txt and show me its contents`,
    );

    const foundToolCall = await rig.waitForToolCall('read_file');

    // Add debugging information
    if (!foundToolCall || !result.includes('hello world')) {
      printDebugInfo(rig, result, {
        'Found tool call': foundToolCall,
        'Contains hello world': result.includes('hello world'),
      });
    }

    expect(
      foundToolCall,
      'Expected to find a read_file tool call',
    ).toBeTruthy();

    // Validate model output - will throw if no output, warn if missing expected content
    validateModelOutput(result, 'hello world', 'File read test');
  });

  it('should be able to write a file', async () => {
    const rig = new TestRig();
    await rig.setup('should be able to write a file');
    rig.createFile('test.txt', '');

    const result = await rig.run(`edit test.txt to have a hello world message`);

    // Accept multiple valid tools for editing files
    const foundToolCall = await rig.waitForAnyToolCall([
      'write_file',
      'edit',
      'replace',
    ]);

    // Add debugging information
    if (!foundToolCall) {
      printDebugInfo(rig, result);
    }

    expect(
      foundToolCall,
      'Expected to find a write_file, edit, or replace tool call',
    ).toBeTruthy();

    // Validate model output - will throw if no output
    validateModelOutput(result, null, 'File write test');

    const fileContent = rig.readFile('test.txt');

    // Add debugging for file content
    if (!fileContent.toLowerCase().includes('hello')) {
      const writeCalls = rig
        .readToolLogs()
        .filter((t) => t.toolRequest.name === 'write_file')
        .map((t) => t.toolRequest.args);

      printDebugInfo(rig, result, {
        'File content mismatch': true,
        'Expected to contain': 'hello',
        'Actual content': fileContent,
        'Write tool calls': JSON.stringify(writeCalls),
      });
    }

    expect(
      fileContent.toLowerCase().includes('hello'),
      'Expected file to contain hello',
    ).toBeTruthy();

    // Log success info if verbose
    if (process.env['VERBOSE'] === 'true') {
      console.log('File written successfully with hello message.');
    }
  });
});
