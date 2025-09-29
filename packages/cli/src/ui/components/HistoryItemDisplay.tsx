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

import type React from 'react';
import { useMemo } from 'react';
import { escapeAnsiCtrlCodes } from '../utils/textUtils.js';
import type { HistoryItem } from '../types.js';
import { UserMessage } from './messages/UserMessage.js';
import { UserShellMessage } from './messages/UserShellMessage.js';
import { GeminiMessage } from './messages/GeminiMessage.js';
import { InfoMessage } from './messages/InfoMessage.js';
import { ErrorMessage } from './messages/ErrorMessage.js';
import { ToolGroupMessage } from './messages/ToolGroupMessage.js';
import { GeminiMessageContent } from './messages/GeminiMessageContent.js';
import { CompressionMessage } from './messages/CompressionMessage.js';
import { WarningMessage } from './messages/WarningMessage.js';
import { Box } from 'ink';
import { AboutBox } from './AboutBox.js';
import { StatsDisplay } from './StatsDisplay.js';
import { ModelStatsDisplay } from './ModelStatsDisplay.js';
import { ToolStatsDisplay } from './ToolStatsDisplay.js';
import { SessionSummaryDisplay } from './SessionSummaryDisplay.js';
import { Help } from './Help.js';
import type { SlashCommand } from '../commands/types.js';
import { ExtensionsList } from './views/ExtensionsList.js';

interface HistoryItemDisplayProps {
  item: HistoryItem;
  availableTerminalHeight?: number;
  terminalWidth: number;
  isPending: boolean;
  isFocused?: boolean;
  commands?: readonly SlashCommand[];
  activeShellPtyId?: number | null;
  embeddedShellFocused?: boolean;
  availableTerminalHeightGemini?: number;
}

export const HistoryItemDisplay: React.FC<HistoryItemDisplayProps> = ({
  item,
  availableTerminalHeight,
  terminalWidth,
  isPending,
  commands,
  isFocused = true,
  activeShellPtyId,
  embeddedShellFocused,
  availableTerminalHeightGemini,
}) => {
  const itemForDisplay = useMemo(() => escapeAnsiCtrlCodes(item), [item]);

  return (
    <Box flexDirection="column" key={itemForDisplay.id}>
      {/* Render standard message types */}
      {itemForDisplay.type === 'user' && (
        <UserMessage text={itemForDisplay.text} />
      )}
      {itemForDisplay.type === 'user_shell' && (
        <UserShellMessage text={itemForDisplay.text} />
      )}
      {itemForDisplay.type === 'gemini' && (
        <GeminiMessage
          text={itemForDisplay.text}
          isPending={isPending}
          availableTerminalHeight={
            availableTerminalHeightGemini ?? availableTerminalHeight
          }
          terminalWidth={terminalWidth}
        />
      )}
      {itemForDisplay.type === 'gemini_content' && (
        <GeminiMessageContent
          text={itemForDisplay.text}
          isPending={isPending}
          availableTerminalHeight={
            availableTerminalHeightGemini ?? availableTerminalHeight
          }
          terminalWidth={terminalWidth}
        />
      )}
      {itemForDisplay.type === 'info' && (
        <InfoMessage text={itemForDisplay.text} />
      )}
      {itemForDisplay.type === 'warning' && (
        <WarningMessage text={itemForDisplay.text} />
      )}
      {itemForDisplay.type === 'error' && (
        <ErrorMessage text={itemForDisplay.text} />
      )}
      {itemForDisplay.type === 'about' && (
        <AboutBox
          cliVersion={itemForDisplay.cliVersion}
          osVersion={itemForDisplay.osVersion}
          // sandboxEnv={itemForDisplay.sandboxEnv}
          modelVersion={itemForDisplay.modelVersion}
          selectedAuthType={itemForDisplay.selectedAuthType}
          gcpProject={itemForDisplay.gcpProject}
          ideClient={itemForDisplay.ideClient}
        />
      )}
      {itemForDisplay.type === 'help' && commands && (
        <Help commands={commands} />
      )}
      {itemForDisplay.type === 'stats' && (
        <StatsDisplay duration={itemForDisplay.duration} />
      )}
      {itemForDisplay.type === 'model_stats' && <ModelStatsDisplay />}
      {itemForDisplay.type === 'tool_stats' && <ToolStatsDisplay />}
      {itemForDisplay.type === 'quit' && (
        <SessionSummaryDisplay duration={itemForDisplay.duration} />
      )}
      {itemForDisplay.type === 'tool_group' && (
        <ToolGroupMessage
          toolCalls={itemForDisplay.tools}
          groupId={itemForDisplay.id}
          availableTerminalHeight={availableTerminalHeight}
          terminalWidth={terminalWidth}
          isFocused={isFocused}
          activeShellPtyId={activeShellPtyId}
          embeddedShellFocused={embeddedShellFocused}
        />
      )}
      {itemForDisplay.type === 'compression' && (
        <CompressionMessage compression={itemForDisplay.compression} />
      )}
      {itemForDisplay.type === 'extensions_list' && <ExtensionsList />}
    </Box>
  );
};
