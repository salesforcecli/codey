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

describe('run_shell_command', () => {
  it('should be able to run a shell command', async () => {
    const rig = new TestRig();
    await rig.setup('should be able to run a shell command');

    const prompt = `Please run the command "echo hello-world" and show me the output`;

    const result = await rig.run(prompt);

    const foundToolCall = await rig.waitForToolCall('run_shell_command');

    // Add debugging information
    if (!foundToolCall || !result.includes('hello-world')) {
      printDebugInfo(rig, result, {
        'Found tool call': foundToolCall,
        'Contains hello-world': result.includes('hello-world'),
      });
    }

    expect(
      foundToolCall,
      'Expected to find a run_shell_command tool call',
    ).toBeTruthy();

    // Validate model output - will throw if no output, warn if missing expected content
    // Model often reports exit code instead of showing output
    validateModelOutput(
      result,
      ['hello-world', 'exit code 0'],
      'Shell command test',
    );
  });

  it('should be able to run a shell command via stdin', async () => {
    const rig = new TestRig();
    await rig.setup('should be able to run a shell command via stdin');

    const prompt = `Please run the command "echo test-stdin" and show me what it outputs`;

    const result = await rig.run({ stdin: prompt });

    const foundToolCall = await rig.waitForToolCall('run_shell_command');

    // Add debugging information
    if (!foundToolCall || !result.includes('test-stdin')) {
      printDebugInfo(rig, result, {
        'Test type': 'Stdin test',
        'Found tool call': foundToolCall,
        'Contains test-stdin': result.includes('test-stdin'),
      });
    }

    expect(
      foundToolCall,
      'Expected to find a run_shell_command tool call',
    ).toBeTruthy();

    // Validate model output - will throw if no output, warn if missing expected content
    validateModelOutput(result, 'test-stdin', 'Shell command stdin test');
  });

  it('should propagate environment variables to the child process', async () => {
    const rig = new TestRig();
    await rig.setup('should propagate environment variables');

    const varName = 'GEMINI_CLI_TEST_VAR';
    const varValue = `test-value-${Math.random().toString(36).substring(7)}`;
    process.env[varName] = varValue;

    try {
      const prompt = `Use echo to learn the value of the environment variable named ${varName} and tell me what it is.`;
      const result = await rig.run(prompt);

      const foundToolCall = await rig.waitForToolCall('run_shell_command');

      if (!foundToolCall || !result.includes(varValue)) {
        printDebugInfo(rig, result, {
          'Found tool call': foundToolCall,
          'Contains varValue': result.includes(varValue),
        });
      }

      expect(
        foundToolCall,
        'Expected to find a run_shell_command tool call',
      ).toBeTruthy();
      validateModelOutput(result, varValue, 'Env var propagation test');
      expect(result).toContain(varValue);
    } finally {
      delete process.env[varName];
    }
  });

  it('should run a platform-specific file listing command', async () => {
    const rig = new TestRig();
    await rig.setup('should run platform-specific file listing');
    const fileName = `test-file-${Math.random().toString(36).substring(7)}.txt`;
    rig.createFile(fileName, 'test content');

    const prompt = `Run a shell command to list the files in the current directory and tell me what they are. You must use a shell command not the list_directory tool.`;
    const result = await rig.run(prompt);

    const foundToolCall = await rig.waitForToolCall('run_shell_command');

    // Debugging info
    if (!foundToolCall || !result.includes(fileName)) {
      printDebugInfo(rig, result, {
        'Found tool call': foundToolCall,
        'Contains fileName': result.includes(fileName),
      });
    }

    expect(
      foundToolCall,
      'Expected to find a run_shell_command tool call',
    ).toBeTruthy();

    validateModelOutput(result, fileName, 'Platform-specific listing test');
    expect(result).toContain(fileName);
  });
});
