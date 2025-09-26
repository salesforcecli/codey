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

describe('google_web_search', () => {
  it('should be able to search the web', async () => {
    const rig = new TestRig();
    await rig.setup('should be able to search the web');

    let result;
    try {
      result = await rig.run(`what is the weather in London`);
    } catch (error) {
      // Network errors can occur in CI environments
      if (
        error instanceof Error &&
        (error.message.includes('network') || error.message.includes('timeout'))
      ) {
        console.warn(
          'Skipping test due to network error:',
          (error as Error).message,
        );
        return; // Skip the test
      }
      throw error; // Re-throw if not a network error
    }

    const foundToolCall = await rig.waitForToolCall('google_web_search');

    // Add debugging information
    if (!foundToolCall) {
      const allTools = printDebugInfo(rig, result);

      // Check if the tool call failed due to network issues
      const failedSearchCalls = allTools.filter(
        (t) =>
          t.toolRequest.name === 'google_web_search' && !t.toolRequest.success,
      );
      if (failedSearchCalls.length > 0) {
        console.warn(
          'google_web_search tool was called but failed, possibly due to network issues',
        );
        console.warn(
          'Failed calls:',
          failedSearchCalls.map((t) => t.toolRequest.args),
        );
        return; // Skip the test if network issues
      }
    }

    expect(
      foundToolCall,
      'Expected to find a call to google_web_search',
    ).toBeTruthy();

    // Validate model output - will throw if no output, warn if missing expected content
    const hasExpectedContent = validateModelOutput(
      result,
      ['weather', 'london'],
      'Google web search test',
    );

    // If content was missing, log the search queries used
    if (!hasExpectedContent) {
      const searchCalls = rig
        .readToolLogs()
        .filter((t) => t.toolRequest.name === 'google_web_search');
      if (searchCalls.length > 0) {
        console.warn(
          'Search queries used:',
          searchCalls.map((t) => t.toolRequest.args),
        );
      }
    }
  });
});
