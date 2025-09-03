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

import type { SlashCommand } from '../ui/commands/types.js';

/**
 * Defines the contract for any class that can load and provide slash commands.
 * This allows the CommandService to be extended with new command sources
 * (e.g., file-based, remote APIs) without modification.
 *
 * Loaders should receive any necessary dependencies (like Config) via their
 * constructor.
 */
export interface ICommandLoader {
  /**
   * Discovers and returns a list of slash commands from the loader's source.
   * @param signal An AbortSignal to allow cancellation.
   * @returns A promise that resolves to an array of SlashCommand objects.
   */
  loadCommands(signal: AbortSignal): Promise<SlashCommand[]>;
}
