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

import type { Message } from '../types.js';
import { MessageType } from '../types.js';
import type { Config } from '@google/gemini-cli-core';
import type { LoadedSettings } from '../../config/settings.js';

export function createShowMemoryAction(
  config: Config | null,
  settings: LoadedSettings,
  addMessage: (message: Message) => void,
) {
  return async () => {
    if (!config) {
      addMessage({
        type: MessageType.ERROR,
        content: 'Configuration not available. Cannot show memory.',
        timestamp: new Date(),
      });
      return;
    }

    const debugMode = config.getDebugMode();

    if (debugMode) {
      console.log('[DEBUG] Show Memory command invoked.');
    }

    const currentMemory = config.getUserMemory();
    const fileCount = config.getGeminiMdFileCount();
    const contextFileName = settings.merged.context?.fileName;
    const contextFileNames = Array.isArray(contextFileName)
      ? contextFileName
      : [contextFileName];

    if (debugMode) {
      console.log(
        `[DEBUG] Showing memory. Content from config.getUserMemory() (first 200 chars): ${currentMemory.substring(0, 200)}...`,
      );
      console.log(`[DEBUG] Number of context files loaded: ${fileCount}`);
    }

    if (fileCount > 0) {
      const allNamesTheSame = new Set(contextFileNames).size < 2;
      const name = allNamesTheSame ? contextFileNames[0] : 'context';
      addMessage({
        type: MessageType.INFO,
        content: `Loaded memory from ${fileCount} ${name} file${
          fileCount > 1 ? 's' : ''
        }.`,
        timestamp: new Date(),
      });
    }

    if (currentMemory && currentMemory.trim().length > 0) {
      addMessage({
        type: MessageType.INFO,
        content: `Current combined memory content:\n\`\`\`markdown\n${currentMemory}\n\`\`\``,
        timestamp: new Date(),
      });
    } else {
      addMessage({
        type: MessageType.INFO,
        content:
          fileCount > 0
            ? 'Hierarchical memory (CODEY.md or other context files) is loaded but content is empty.'
            : 'No hierarchical memory (CODEY.md or other context files) is currently loaded.',
        timestamp: new Date(),
      });
    }
  };
}
