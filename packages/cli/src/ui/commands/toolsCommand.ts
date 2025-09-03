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
  type CommandContext,
  type SlashCommand,
  CommandKind,
} from './types.js';
import { MessageType } from '../types.js';

export const toolsCommand: SlashCommand = {
  name: 'tools',
  description: 'list available Codey tools. Usage: /tools [desc]',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext, args?: string): Promise<void> => {
    const subCommand = args?.trim();

    // Default to NOT showing descriptions. The user must opt in with an argument.
    let useShowDescriptions = false;
    if (subCommand === 'desc' || subCommand === 'descriptions') {
      useShowDescriptions = true;
    }

    const toolRegistry = context.services.config?.getToolRegistry();
    if (!toolRegistry) {
      context.ui.addItem(
        {
          type: MessageType.ERROR,
          text: 'Could not retrieve tool registry.',
        },
        Date.now(),
      );
      return;
    }

    const tools = toolRegistry.getAllTools();
    // Filter out MCP tools by checking for the absence of a serverName property
    const geminiTools = tools.filter((tool) => !('serverName' in tool));

    let message = 'Available Gemini CLI tools:\n\n';

    if (geminiTools.length > 0) {
      geminiTools.forEach((tool) => {
        if (useShowDescriptions && tool.description) {
          message += `  - \u001b[36m${tool.displayName} (${tool.name})\u001b[0m:\n`;

          const greenColor = '\u001b[32m';
          const resetColor = '\u001b[0m';

          // Handle multi-line descriptions
          const descLines = tool.description.trim().split('\n');
          for (const descLine of descLines) {
            message += `      ${greenColor}${descLine}${resetColor}\n`;
          }
        } else {
          message += `  - \u001b[36m${tool.displayName}\u001b[0m\n`;
        }
      });
    } else {
      message += '  No tools available\n';
    }
    message += '\n';

    message += '\u001b[0m';

    context.ui.addItem({ type: MessageType.INFO, text: message }, Date.now());
  },
};
