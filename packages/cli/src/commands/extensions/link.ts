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
import { installExtension } from '../../config/extension.js';
import type { ExtensionInstallMetadata } from '@salesforce/codey-core';

import { getErrorMessage } from '../../utils/errors.js';

interface InstallArgs {
  path: string;
}

export async function handleLink(args: InstallArgs) {
  try {
    const installMetadata: ExtensionInstallMetadata = {
      source: args.path,
      type: 'link',
    };
    const extensionName = await installExtension(installMetadata);
    console.log(
      `Extension "${extensionName}" linked successfully and enabled.`,
    );
  } catch (error) {
    console.error(getErrorMessage(error));
    process.exit(1);
  }
}

export const linkCommand: CommandModule = {
  command: 'link <path>',
  describe:
    'Links an extension from a local path. Updates made to the local path will always be reflected.',
  builder: (yargs) =>
    yargs
      .positional('path', {
        describe: 'The name of the extension to link.',
        type: 'string',
      })
      .check((_) => true),
  handler: async (argv) => {
    await handleLink({
      path: argv['path'] as string,
    });
  },
};
