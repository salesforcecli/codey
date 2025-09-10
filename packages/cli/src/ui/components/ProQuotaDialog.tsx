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
import { RadioButtonSelect } from './shared/RadioButtonSelect.js';
import { Colors } from '../colors.js';

interface ProQuotaDialogProps {
  failedModel: string;
  fallbackModel: string;
  onChoice: (choice: 'auth' | 'continue') => void;
}

export function ProQuotaDialog({
  failedModel,
  fallbackModel,
  onChoice,
}: ProQuotaDialogProps): React.JSX.Element {
  const items = [
    {
      label: 'Change auth (executes the /auth command)',
      value: 'auth' as const,
    },
    {
      label: `Continue with ${fallbackModel}`,
      value: 'continue' as const,
    },
  ];

  const handleSelect = (choice: 'auth' | 'continue') => {
    onChoice(choice);
  };

  return (
    <Box borderStyle="round" flexDirection="column" paddingX={1}>
      <Text bold color={Colors.AccentYellow}>
        Pro quota limit reached for {failedModel}.
      </Text>
      <Box marginTop={1}>
        <RadioButtonSelect
          items={items}
          initialIndex={1}
          onSelect={handleSelect}
        />
      </Box>
    </Box>
  );
}
