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

import { useState, useEffect, useCallback } from 'react';
import { spawnAsync } from '@salesforce/codey-core';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';

export function useGitBranchName(cwd: string): string | undefined {
  const [branchName, setBranchName] = useState<string | undefined>(undefined);

  const fetchBranchName = useCallback(async () => {
    try {
      const { stdout } = await spawnAsync(
        'git',
        ['rev-parse', '--abbrev-ref', 'HEAD'],
        { cwd },
      );
      const branch = stdout.toString().trim();
      if (branch && branch !== 'HEAD') {
        setBranchName(branch);
      } else {
        const { stdout: hashStdout } = await spawnAsync(
          'git',
          ['rev-parse', '--short', 'HEAD'],
          { cwd },
        );
        setBranchName(hashStdout.toString().trim());
      }
    } catch (_error) {
      setBranchName(undefined);
    }
  }, [cwd, setBranchName]);

  useEffect(() => {
    fetchBranchName(); // Initial fetch

    const gitLogsHeadPath = path.join(cwd, '.git', 'logs', 'HEAD');
    let watcher: fs.FSWatcher | undefined;

    const setupWatcher = async () => {
      try {
        // Check if .git/logs/HEAD exists, as it might not in a new repo or orphaned head
        await fsPromises.access(gitLogsHeadPath, fs.constants.F_OK);
        watcher = fs.watch(gitLogsHeadPath, (eventType: string) => {
          // Changes to .git/logs/HEAD (appends) indicate HEAD has likely changed
          if (eventType === 'change' || eventType === 'rename') {
            // Handle rename just in case
            fetchBranchName();
          }
        });
      } catch (_watchError) {
        // Silently ignore watcher errors (e.g. permissions or file not existing),
        // similar to how exec errors are handled.
        // The branch name will simply not update automatically.
      }
    };

    setupWatcher();

    return () => {
      watcher?.close();
    };
  }, [cwd, fetchBranchName]);

  return branchName;
}
