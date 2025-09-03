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

import { TestRig } from './test-helper.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';

describe('session-summary flag', () => {
  let rig: TestRig;

  beforeEach(function (context) {
    rig = new TestRig();
    if (context.task.name) {
      rig.setup(context.task.name);
    }
  });

  afterEach(async () => {
    await rig.cleanup();
  });

  it('should write a session summary in non-interactive mode', async () => {
    const summaryPath = join(rig.testDir!, 'summary.json');
    await rig.run('Say hello', '--session-summary', summaryPath);

    const summaryContent = readFileSync(summaryPath, 'utf-8');
    const summary = JSON.parse(summaryContent);

    expect(summary).toBeDefined();
    expect(summary.sessionMetrics.models).toBeDefined();
    expect(summary.sessionMetrics.tools).toBeDefined();
  });
});
