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

import type { CommandContext } from '../commands/types.js';

/**
 * Creates a UI context object with no-op functions.
 * Useful for non-interactive environments where UI operations
 * are not applicable.
 */
export function createNonInteractiveUI(): CommandContext['ui'] {
  return {
    addItem: (_item, _timestamp) => 0,
    clear: () => {},
    setDebugMessage: (_message) => {},
    loadHistory: (_newHistory) => {},
    pendingItem: null,
    setPendingItem: (_item) => {},
    toggleCorgiMode: () => {},
    toggleVimEnabled: async () => false,
    setGeminiMdFileCount: (_count) => {},
    reloadCommands: () => {},
    extensionsUpdateState: new Map(),
    setExtensionsUpdateState: (_updateState) => {},
  };
}
