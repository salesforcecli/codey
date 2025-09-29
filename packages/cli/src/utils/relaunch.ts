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

import { spawn } from 'node:child_process';
import { RELAUNCH_EXIT_CODE } from './processUtils.js';

export async function relaunchOnExitCode(runner: () => Promise<number>) {
  while (true) {
    try {
      const exitCode = await runner();

      if (exitCode !== RELAUNCH_EXIT_CODE) {
        process.exit(exitCode);
      }
    } catch (error) {
      process.stdin.resume();
      console.error('Fatal error: Failed to relaunch the CLI process.', error);
      process.exit(1);
    }
  }
}

export async function relaunchAppInChildProcess(
  additionalNodeArgs: string[],
  additionalScriptArgs: string[],
) {
  if (process.env['GEMINI_CLI_NO_RELAUNCH']) {
    return;
  }

  const runner = () => {
    // process.argv is [node, script, ...args]
    // We want to construct [ ...nodeArgs, script, ...scriptArgs]
    const script = process.argv[1];
    const scriptArgs = process.argv.slice(2);

    const nodeArgs = [
      ...process.execArgv,
      ...additionalNodeArgs,
      script,
      ...additionalScriptArgs,
      ...scriptArgs,
    ];
    const newEnv = { ...process.env, GEMINI_CLI_NO_RELAUNCH: 'true' };

    // The parent process should not be reading from stdin while the child is running.
    process.stdin.pause();

    const child = spawn(process.execPath, nodeArgs, {
      stdio: 'inherit',
      env: newEnv,
    });

    return new Promise<number>((resolve, reject) => {
      child.on('error', reject);
      child.on('close', (code) => {
        // Resume stdin before the parent process exits.
        process.stdin.resume();
        resolve(code ?? 1);
      });
    });
  };

  await relaunchOnExitCode(runner);
}
