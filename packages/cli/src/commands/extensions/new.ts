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

import { access, cp, mkdir, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { CommandModule } from 'yargs';
import { fileURLToPath } from 'node:url';
import { getErrorMessage } from '../../utils/errors.js';

interface NewArgs {
  path: string;
  template: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EXAMPLES_PATH = join(__dirname, 'examples');

async function pathExists(path: string) {
  try {
    await access(path);
    return true;
  } catch (_e) {
    return false;
  }
}

async function copyDirectory(template: string, path: string) {
  if (await pathExists(path)) {
    throw new Error(`Path already exists: ${path}`);
  }

  const examplePath = join(EXAMPLES_PATH, template);
  await mkdir(path, { recursive: true });
  await cp(examplePath, path, { recursive: true });
}

async function handleNew(args: NewArgs) {
  try {
    await copyDirectory(args.template, args.path);
    console.log(
      `Successfully created new extension from template "${args.template}" at ${args.path}.`,
    );
    console.log(
      `You can install this using "gemini extensions link ${args.path}" to test it out.`,
    );
  } catch (error) {
    console.error(getErrorMessage(error));
    throw error;
  }
}

async function getBoilerplateChoices() {
  const entries = await readdir(EXAMPLES_PATH, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

export const newCommand: CommandModule = {
  command: 'new <path> <template>',
  describe: 'Create a new extension from a boilerplate example.',
  builder: async (yargs) => {
    const choices = await getBoilerplateChoices();
    return yargs
      .positional('path', {
        describe: 'The path to create the extension in.',
        type: 'string',
      })
      .positional('template', {
        describe: 'The boilerplate template to use.',
        type: 'string',
        choices,
      });
  },
  handler: async (args) => {
    await handleNew({
      path: args['path'] as string,
      template: args['template'] as string,
    });
  },
};
