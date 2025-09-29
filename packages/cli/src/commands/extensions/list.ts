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

import type { CommandModule } from 'yargs';
import { loadUserExtensions, toOutputString } from '../../config/extension.js';
import { getErrorMessage } from '../../utils/errors.js';

export async function handleList() {
  try {
    const extensions = loadUserExtensions();
    if (extensions.length === 0) {
      console.log('No extensions installed.');
      return;
    }
    console.log(
      extensions
        .map((extension, _): string => toOutputString(extension, process.cwd()))
        .join('\n\n'),
    );
  } catch (error) {
    console.error(getErrorMessage(error));
    process.exit(1);
  }
}

export const listCommand: CommandModule = {
  command: 'list',
  describe: 'Lists installed extensions.',
  builder: (yargs) => yargs,
  handler: async () => {
    await handleList();
  },
};
