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

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

/**
 * Defines the structure of a virtual file system to be created for testing.
 * Keys are file or directory names, and values can be:
 * - A string: The content of a file.
 * - A `FileSystemStructure` object: Represents a subdirectory with its own structure.
 * - An array of strings or `FileSystemStructure` objects: Represents a directory
 *   where strings are empty files and objects are subdirectories.
 *
 * @example
 * // Example 1: Simple files and directories
 * const structure1 = {
 *   'file1.txt': 'Hello, world!',
 *   'empty-dir': [],
 *   'src': {
 *     'main.js': '// Main application file',
 *     'utils.ts': '// Utility functions',
 *   },
 * };
 *
 * @example
 * // Example 2: Nested directories and empty files within an array
 * const structure2 = {
 *   'config.json': '{ "port": 3000 }',
 *   'data': [
 *     'users.csv',
 *     'products.json',
 *     {
 *       'logs': [
 *         'error.log',
 *         'access.log',
 *       ],
 *     },
 *   ],
 * };
 */
export type FileSystemStructure = {
  [name: string]:
    | string
    | FileSystemStructure
    | Array<string | FileSystemStructure>;
};

/**
 * Recursively creates files and directories based on the provided `FileSystemStructure`.
 * @param dir The base directory where the structure will be created.
 * @param structure The `FileSystemStructure` defining the files and directories.
 */
async function create(dir: string, structure: FileSystemStructure) {
  for (const [name, content] of Object.entries(structure)) {
    const newPath = path.join(dir, name);
    if (typeof content === 'string') {
      await fs.writeFile(newPath, content);
    } else if (Array.isArray(content)) {
      await fs.mkdir(newPath, { recursive: true });
      for (const item of content) {
        if (typeof item === 'string') {
          await fs.writeFile(path.join(newPath, item), '');
        } else {
          await create(newPath, item as FileSystemStructure);
        }
      }
    } else if (typeof content === 'object' && content !== null) {
      await fs.mkdir(newPath, { recursive: true });
      await create(newPath, content as FileSystemStructure);
    }
  }
}

/**
 * Creates a temporary directory and populates it with a given file system structure.
 * @param structure The `FileSystemStructure` to create within the temporary directory.
 * @returns A promise that resolves to the absolute path of the created temporary directory.
 */
export async function createTmpDir(
  structure: FileSystemStructure,
): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gemini-cli-test-'));
  await create(tmpDir, structure);
  return tmpDir;
}

/**
 * Cleans up (deletes) a temporary directory and its contents.
 * @param dir The absolute path to the temporary directory to clean up.
 */
export async function cleanupTmpDir(dir: string) {
  await fs.rm(dir, { recursive: true, force: true });
}
