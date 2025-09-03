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

describe('save_memory', () => {
  it('should be able to save to memory', async () => {
    const rig = new TestRig();
    await rig.setup('should be able to save to memory');

    const prompt = `remember that my favorite color is  blue.

  what is my favorite color? tell me that and surround it with $ symbol`;
    const result = await rig.run(prompt);

    const foundToolCall = await rig.waitForToolCall('save_memory');

    // Add debugging information
    if (!foundToolCall || !result.toLowerCase().includes('blue')) {
      const allTools = printDebugInfo(rig, result, {
        'Found tool call': foundToolCall,
        'Contains blue': result.toLowerCase().includes('blue'),
      });

      console.error(
        'Memory tool calls:',
        allTools
          .filter((t) => t.toolRequest.name === 'save_memory')
          .map((t) => t.toolRequest.args),
      );
    }

    expect(
      foundToolCall,
      'Expected to find a save_memory tool call',
    ).toBeTruthy();

    // Validate model output - will throw if no output, warn if missing expected content
    validateModelOutput(result, 'blue', 'Save memory test');
  });
});
