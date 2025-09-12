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
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import type { ConsoleMessageItem } from '../types.js';
import { MaxSizedBox } from './shared/MaxSizedBox.js';

interface DetailedMessagesDisplayProps {
  messages: ConsoleMessageItem[];
  maxHeight: number | undefined;
  width: number;
  // debugMode is not needed here if App.tsx filters debug messages before passing them.
  // If DetailedMessagesDisplay should handle filtering, add debugMode prop.
}

export const DetailedMessagesDisplay: React.FC<
  DetailedMessagesDisplayProps
> = ({ messages, maxHeight, width }) => {
  if (messages.length === 0) {
    return null; // Don't render anything if there are no messages
  }

  const borderAndPadding = 4;
  return (
    <Box
      flexDirection="column"
      marginTop={1}
      borderStyle="round"
      borderColor={theme.border.default}
      paddingX={1}
      width={width}
    >
      <Box marginBottom={1}>
        <Text bold color={theme.text.primary}>
          Debug Console{' '}
          <Text color={theme.text.secondary}>(ctrl+o to close)</Text>
        </Text>
      </Box>
      <MaxSizedBox maxHeight={maxHeight} maxWidth={width - borderAndPadding}>
        {messages.map((msg, index) => {
          let textColor = theme.text.primary;
          let icon = '\u2139'; // Information source (ℹ)

          switch (msg.type) {
            case 'warn':
              textColor = theme.status.warning;
              icon = '\u26A0'; // Warning sign (⚠)
              break;
            case 'error':
              textColor = theme.status.error;
              icon = '\u2716'; // Heavy multiplication x (✖)
              break;
            case 'debug':
              textColor = theme.text.secondary; // Or theme.text.secondary
              icon = '\u{1F50D}'; // Left-pointing magnifying glass (🔍)
              break;
            case 'log':
            default:
              // Default textColor and icon are already set
              break;
          }

          return (
            <Box key={index} flexDirection="row">
              <Text color={textColor}>{icon} </Text>
              <Text color={textColor} wrap="wrap">
                {msg.content}
                {msg.count && msg.count > 1 && (
                  <Text color={theme.text.secondary}> (x{msg.count})</Text>
                )}
              </Text>
            </Box>
          );
        })}
      </MaxSizedBox>
    </Box>
  );
};
