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

import type { ICommandLoader } from './types.js';
import type { SlashCommand } from '../ui/commands/types.js';
import type { Config } from '@salesforce/codey-core';
import { aboutCommand } from '../ui/commands/aboutCommand.js';
import { authCommand } from '../ui/commands/authCommand.js';
import { bugCommand } from '../ui/commands/bugCommand.js';
import { chatCommand } from '../ui/commands/chatCommand.js';
import { clearCommand } from '../ui/commands/clearCommand.js';
import { compressCommand } from '../ui/commands/compressCommand.js';
import { copyCommand } from '../ui/commands/copyCommand.js';
import { directoryCommand } from '../ui/commands/directoryCommand.js';
import { editorCommand } from '../ui/commands/editorCommand.js';
import { extensionsCommand } from '../ui/commands/extensionsCommand.js';
import { helpCommand } from '../ui/commands/helpCommand.js';
import { initCommand } from '../ui/commands/initCommand.js';
import { mcpCommand } from '../ui/commands/mcpCommand.js';
import { memoryCommand } from '../ui/commands/memoryCommand.js';
// import { modelCommand } from '../ui/commands/modelCommand.js';
import { permissionsCommand } from '../ui/commands/permissionsCommand.js';
// import { privacyCommand } from '../ui/commands/privacyCommand.js';
import { quitCommand } from '../ui/commands/quitCommand.js';
import { restoreCommand } from '../ui/commands/restoreCommand.js';
import { statsCommand } from '../ui/commands/statsCommand.js';
import { themeCommand } from '../ui/commands/themeCommand.js';
import { toolsCommand } from '../ui/commands/toolsCommand.js';
import { settingsCommand } from '../ui/commands/settingsCommand.js';
import { vimCommand } from '../ui/commands/vimCommand.js';
import { terminalSetupCommand } from '../ui/commands/terminalSetupCommand.js';

/**
 * Loads the core, hard-coded slash commands that are an integral part
 * of the Gemini CLI application.
 */
export class BuiltinCommandLoader implements ICommandLoader {
  constructor(private config: Config | null) {}

  /**
   * Gathers all raw built-in command definitions, injects dependencies where
   * needed (e.g., config) and filters out any that are not available.
   *
   * @param _signal An AbortSignal (unused for this synchronous loader).
   * @returns A promise that resolves to an array of `SlashCommand` objects.
   */
  async loadCommands(_signal: AbortSignal): Promise<SlashCommand[]> {
    const allDefinitions: Array<SlashCommand | null> = [
      aboutCommand,
      authCommand,
      bugCommand,
      chatCommand,
      clearCommand,
      compressCommand,
      copyCommand,
      directoryCommand,
      editorCommand,
      extensionsCommand,
      helpCommand,
      initCommand,
      mcpCommand,
      memoryCommand,
      // ...(this.config?.getUseModelRouter() ? [modelCommand] : []),
      ...(this.config?.getFolderTrust() ? [permissionsCommand] : []),
      // privacyCommand,
      quitCommand,
      restoreCommand(this.config),
      statsCommand,
      themeCommand,
      toolsCommand,
      settingsCommand,
      vimCommand,
      terminalSetupCommand,
    ];

    return allDefinitions.filter((cmd): cmd is SlashCommand => cmd !== null);
  }
}
