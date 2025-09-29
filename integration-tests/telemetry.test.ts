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

describe('telemetry', () => {
  it('should emit a metric and a log event', async () => {
    const rig = new TestRig();
    rig.setup('should emit a metric and a log event');

    // Run a simple command that should trigger telemetry
    await rig.run('just saying hi');

    // Verify that a user_prompt event was logged
    const hasUserPromptEvent = await rig.waitForTelemetryEvent('user_prompt');
    expect(hasUserPromptEvent).toBe(true);

    // Verify that a cli_command_count metric was emitted
    const cliCommandCountMetric = rig.readMetric('session.count');
    expect(cliCommandCountMetric).not.toBeNull();
  });
});
