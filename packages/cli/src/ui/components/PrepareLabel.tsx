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
import { Text } from 'ink';
import { theme } from '../semantic-colors.js';

interface PrepareLabelProps {
  label: string;
  matchedIndex?: number;
  userInput: string;
  textColor: string;
  highlightColor?: string;
}

export const PrepareLabel: React.FC<PrepareLabelProps> = ({
  label,
  matchedIndex,
  userInput,
  textColor,
  highlightColor = theme.status.warning,
}) => {
  if (
    matchedIndex === undefined ||
    matchedIndex < 0 ||
    matchedIndex >= label.length ||
    userInput.length === 0
  ) {
    return <Text color={textColor}>{label}</Text>;
  }

  const start = label.slice(0, matchedIndex);
  const match = label.slice(matchedIndex, matchedIndex + userInput.length);
  const end = label.slice(matchedIndex + userInput.length);

  return (
    <Text>
      <Text color={textColor}>{start}</Text>
      <Text color="black" bold backgroundColor={highlightColor}>
        {match}
      </Text>
      <Text color={textColor}>{end}</Text>
    </Text>
  );
};
