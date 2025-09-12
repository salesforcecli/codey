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
import { useOverflowState } from '../contexts/OverflowContext.js';
import { useStreamingContext } from '../contexts/StreamingContext.js';
import { StreamingState } from '../types.js';
import { theme } from '../semantic-colors.js';

interface ShowMoreLinesProps {
  constrainHeight: boolean;
}

export const ShowMoreLines = ({ constrainHeight }: ShowMoreLinesProps) => {
  const overflowState = useOverflowState();
  const streamingState = useStreamingContext();

  if (
    overflowState === undefined ||
    overflowState.overflowingIds.size === 0 ||
    !constrainHeight ||
    !(
      streamingState === StreamingState.Idle ||
      streamingState === StreamingState.WaitingForConfirmation
    )
  ) {
    return null;
  }

  return (
    <Box>
      <Text color={theme.text.secondary} wrap="truncate">
        Press ctrl-s to show more lines
      </Text>
    </Box>
  );
};
