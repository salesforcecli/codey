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

import fs from 'node:fs/promises';
import * as os from 'node:os';
import path from 'node:path';

type WarningCheck = {
  id: string;
  check: (workspaceRoot: string) => Promise<string | null>;
};

// Individual warning checks
const homeDirectoryCheck: WarningCheck = {
  id: 'home-directory',
  check: async (workspaceRoot: string) => {
    try {
      const [workspaceRealPath, homeRealPath] = await Promise.all([
        fs.realpath(workspaceRoot),
        fs.realpath(os.homedir()),
      ]);

      if (workspaceRealPath === homeRealPath) {
        return 'You are running Gemini CLI in your home directory. It is recommended to run in a project-specific directory.';
      }
      return null;
    } catch (_err: unknown) {
      return 'Could not verify the current directory due to a file system error.';
    }
  },
};

const rootDirectoryCheck: WarningCheck = {
  id: 'root-directory',
  check: async (workspaceRoot: string) => {
    try {
      const workspaceRealPath = await fs.realpath(workspaceRoot);
      const errorMessage =
        'Warning: You are running Gemini CLI in the root directory. Your entire folder structure will be used for context. It is strongly recommended to run in a project-specific directory.';

      // Check for Unix root directory
      if (path.dirname(workspaceRealPath) === workspaceRealPath) {
        return errorMessage;
      }

      return null;
    } catch (_err: unknown) {
      return 'Could not verify the current directory due to a file system error.';
    }
  },
};

// All warning checks
const WARNING_CHECKS: readonly WarningCheck[] = [
  homeDirectoryCheck,
  rootDirectoryCheck,
];

export async function getUserStartupWarnings(
  workspaceRoot: string = process.cwd(),
): Promise<string[]> {
  const results = await Promise.all(
    WARNING_CHECKS.map((check) => check.check(workspaceRoot)),
  );
  return results.filter((msg) => msg !== null);
}
