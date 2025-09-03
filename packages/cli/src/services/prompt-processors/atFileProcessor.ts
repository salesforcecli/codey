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

import {
  flatMapTextParts,
  readPathFromWorkspace,
} from '@google/gemini-cli-core';
import type { CommandContext } from '../../ui/commands/types.js';
import { MessageType } from '../../ui/types.js';
import {
  AT_FILE_INJECTION_TRIGGER,
  type IPromptProcessor,
  type PromptPipelineContent,
} from './types.js';
import { extractInjections } from './injectionParser.js';

export class AtFileProcessor implements IPromptProcessor {
  constructor(private readonly commandName?: string) {}

  async process(
    input: PromptPipelineContent,
    context: CommandContext,
  ): Promise<PromptPipelineContent> {
    const config = context.services.config;
    if (!config) {
      return input;
    }

    return flatMapTextParts(input, async (text) => {
      if (!text.includes(AT_FILE_INJECTION_TRIGGER)) {
        return [{ text }];
      }

      const injections = extractInjections(
        text,
        AT_FILE_INJECTION_TRIGGER,
        this.commandName,
      );
      if (injections.length === 0) {
        return [{ text }];
      }

      const output: PromptPipelineContent = [];
      let lastIndex = 0;

      for (const injection of injections) {
        const prefix = text.substring(lastIndex, injection.startIndex);
        if (prefix) {
          output.push({ text: prefix });
        }

        const pathStr = injection.content;
        try {
          const fileContentParts = await readPathFromWorkspace(pathStr, config);
          if (fileContentParts.length === 0) {
            const uiMessage = `File '@{${pathStr}}' was ignored by .gitignore or .codeyignore and was not included in the prompt.`;
            context.ui.addItem(
              { type: MessageType.INFO, text: uiMessage },
              Date.now(),
            );
          }
          output.push(...fileContentParts);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          const uiMessage = `Failed to inject content for '@{${pathStr}}': ${message}`;

          console.error(
            `[AtFileProcessor] ${uiMessage}. Leaving placeholder in prompt.`,
          );
          context.ui.addItem(
            { type: MessageType.ERROR, text: uiMessage },
            Date.now(),
          );

          const placeholder = text.substring(
            injection.startIndex,
            injection.endIndex,
          );
          output.push({ text: placeholder });
        }
        lastIndex = injection.endIndex;
      }

      const suffix = text.substring(lastIndex);
      if (suffix) {
        output.push({ text: suffix });
      }

      return output;
    });
  }
}
