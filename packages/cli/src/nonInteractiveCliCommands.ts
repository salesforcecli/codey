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

import type { PartListUnion } from '@google/genai';
import { parseSlashCommand } from './utils/commands.js';
import {
  FatalInputError,
  Logger,
  uiTelemetryService,
  type Config,
} from '@salesforce/codey-core';
import { CommandService } from './services/CommandService.js';
import { FileCommandLoader } from './services/FileCommandLoader.js';
import type { CommandContext } from './ui/commands/types.js';
import { createNonInteractiveUI } from './ui/noninteractive/nonInteractiveUi.js';
import type { LoadedSettings } from './config/settings.js';
import type { SessionStatsState } from './ui/contexts/SessionContext.js';

/**
 * Processes a slash command in a non-interactive environment.
 *
 * @returns A Promise that resolves to `PartListUnion` if a valid command is
 *   found and results in a prompt, or `undefined` otherwise.
 * @throws {FatalInputError} if the command result is not supported in
 *   non-interactive mode.
 */
export const handleSlashCommand = async (
  rawQuery: string,
  abortController: AbortController,
  config: Config,
  settings: LoadedSettings,
): Promise<PartListUnion | undefined> => {
  const trimmed = rawQuery.trim();
  if (!trimmed.startsWith('/')) {
    return;
  }

  // Only custom commands are supported for now.
  const loaders = [new FileCommandLoader(config)];
  const commandService = await CommandService.create(
    loaders,
    abortController.signal,
  );
  const commands = commandService.getCommands();

  const { commandToExecute, args } = parseSlashCommand(rawQuery, commands);

  if (commandToExecute) {
    if (commandToExecute.action) {
      // Not used by custom commands but may be in the future.
      const sessionStats: SessionStatsState = {
        sessionId: config?.getSessionId(),
        sessionStartTime: new Date(),
        metrics: uiTelemetryService.getMetrics(),
        lastPromptTokenCount: 0,
        promptCount: 1,
      };

      const logger = new Logger(config?.getSessionId() || '', config?.storage);

      const context: CommandContext = {
        services: {
          config,
          settings,
          git: undefined,
          logger,
        },
        ui: createNonInteractiveUI(),
        session: {
          stats: sessionStats,
          sessionShellAllowlist: new Set(),
        },
        invocation: {
          raw: trimmed,
          name: commandToExecute.name,
          args,
        },
      };

      const result = await commandToExecute.action(context, args);

      if (result) {
        switch (result.type) {
          case 'submit_prompt':
            return result.content;
          case 'confirm_shell_commands':
            // This result indicates a command attempted to confirm shell commands.
            // However note that currently, ShellTool is excluded in non-interactive
            // mode unless 'YOLO mode' is active, so confirmation actually won't
            // occur because of YOLO mode.
            // This ensures that if a command *does* request confirmation (e.g.
            // in the future with more granular permissions), it's handled appropriately.
            throw new FatalInputError(
              'Exiting due to a confirmation prompt requested by the command.',
            );
          default:
            throw new FatalInputError(
              'Exiting due to command result that is not supported in non-interactive mode.',
            );
        }
      }
    }
  }

  return;
};
