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

import { Box, Text } from 'ink';

const MAX_DISPLAYED_QUEUED_MESSAGES = 3;

export interface QueuedMessageDisplayProps {
  messageQueue: string[];
}

export const QueuedMessageDisplay = ({
  messageQueue,
}: QueuedMessageDisplayProps) => {
  if (messageQueue.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      {messageQueue
        .slice(0, MAX_DISPLAYED_QUEUED_MESSAGES)
        .map((message, index) => {
          const preview = message.replace(/\s+/g, ' ');

          return (
            <Box key={index} paddingLeft={2} width="100%">
              <Text dimColor wrap="truncate">
                {preview}
              </Text>
            </Box>
          );
        })}
      {messageQueue.length > MAX_DISPLAYED_QUEUED_MESSAGES && (
        <Box paddingLeft={2}>
          <Text dimColor>
            ... (+
            {messageQueue.length - MAX_DISPLAYED_QUEUED_MESSAGES} more)
          </Text>
        </Box>
      )}
    </Box>
  );
};
