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

import { expect, test } from 'vitest';
import { TestRig } from './test-helper.js';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const extension = `{
  "name": "test-extension",
  "version": "0.0.1"
}`;

const extensionUpdate = `{
  "name": "test-extension",
  "version": "0.0.2"
}`;

test('installs a local extension, verifies a command, and updates it', async () => {
  const rig = new TestRig();
  rig.setup('extension install test');
  const testServerPath = join(rig.testDir!, 'gemini-extension.json');
  writeFileSync(testServerPath, extension);
  try {
    await rig.runCommand(['extensions', 'uninstall', 'test-extension']);
  } catch {
    /* empty */
  }

  const result = await rig.runCommand(
    ['extensions', 'install', `--path=${rig.testDir!}`],
    { stdin: 'y\n' },
  );
  expect(result).toContain('test-extension');

  const listResult = await rig.runCommand(['extensions', 'list']);
  expect(listResult).toContain('test-extension');
  writeFileSync(testServerPath, extensionUpdate);
  const updateResult = await rig.runCommand([
    'extensions',
    'update',
    `test-extension`,
  ]);
  expect(updateResult).toContain('0.0.2');

  await rig.runCommand(['extensions', 'uninstall', 'test-extension']);

  await rig.cleanup();
});
