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
import {
  installExtension,
  type ExtensionInstallMetadata,
} from '../../config/extension.js';

import { getErrorMessage } from '../../utils/errors.js';

interface InstallArgs {
  source?: string;
  path?: string;
}

const ORG_REPO_REGEX = /^[a-zA-Z0-9-]+\/[\w.-]+$/;

export async function handleInstall(args: InstallArgs) {
  try {
    let installMetadata: ExtensionInstallMetadata;

    if (args.source) {
      const { source } = args;
      if (
        source.startsWith('http://') ||
        source.startsWith('https://') ||
        source.startsWith('git@')
      ) {
        installMetadata = {
          source,
          type: 'git',
        };
      } else if (ORG_REPO_REGEX.test(source)) {
        installMetadata = {
          source: `https://github.com/${source}.git`,
          type: 'git',
        };
      } else {
        throw new Error(
          `The source "${source}" is not a valid URL or "org/repo" format.`,
        );
      }
    } else if (args.path) {
      installMetadata = {
        source: args.path,
        type: 'local',
      };
    } else {
      // This should not be reached due to the yargs check.
      throw new Error('Either --source or --path must be provided.');
    }

    const extensionName = await installExtension(installMetadata);
    console.log(
      `Extension "${extensionName}" installed successfully and enabled.`,
    );
  } catch (error) {
    console.error(getErrorMessage(error));
    process.exit(1);
  }
}

export const installCommand: CommandModule = {
  command: 'install [--source | --path ]',
  describe:
    'Installs an extension from a git repository (URL or "org/repo") or a local path.',
  builder: (yargs) =>
    yargs
      .option('source', {
        describe: 'The git URL or "org/repo" of the extension to install.',
        type: 'string',
      })
      .option('path', {
        describe: 'Path to a local extension directory.',
        type: 'string',
      })
      .conflicts('source', 'path')
      .check((argv) => {
        if (!argv.source && !argv.path) {
          throw new Error('Either --source or --path must be provided.');
        }
        return true;
      }),
  handler: async (argv) => {
    await handleInstall({
      source: argv['source'] as string | undefined,
      path: argv['path'] as string | undefined,
    });
  },
};
