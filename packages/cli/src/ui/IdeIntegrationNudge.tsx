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

import type { DetectedIde } from '@salesforce/codey-core';
import { getIdeInfo } from '@salesforce/codey-core';
import { Box, Text } from 'ink';
import type { RadioSelectItem } from './components/shared/RadioButtonSelect.js';
import { RadioButtonSelect } from './components/shared/RadioButtonSelect.js';
import { useKeypress } from './hooks/useKeypress.js';
import { theme } from './semantic-colors.js';

export type IdeIntegrationNudgeResult = {
  userSelection: 'yes' | 'no' | 'dismiss';
  isExtensionPreInstalled: boolean;
};

interface IdeIntegrationNudgeProps {
  ide: DetectedIde;
  onComplete: (result: IdeIntegrationNudgeResult) => void;
}

export function IdeIntegrationNudge({
  ide,
  onComplete,
}: IdeIntegrationNudgeProps) {
  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onComplete({
          userSelection: 'no',
          isExtensionPreInstalled: false,
        });
      }
    },
    { isActive: true },
  );

  const { displayName: ideName } = getIdeInfo(ide);
  // Assume extension is already installed if the env variables are set.
  const isExtensionPreInstalled =
    !!process.env['GEMINI_CLI_IDE_SERVER_PORT'] &&
    !!process.env['GEMINI_CLI_IDE_WORKSPACE_PATH'];

  const OPTIONS: Array<RadioSelectItem<IdeIntegrationNudgeResult>> = [
    {
      label: 'Yes',
      value: {
        userSelection: 'yes',
        isExtensionPreInstalled,
      },
    },
    {
      label: 'No (esc)',
      value: {
        userSelection: 'no',
        isExtensionPreInstalled,
      },
    },
    {
      label: "No, don't ask again",
      value: {
        userSelection: 'dismiss',
        isExtensionPreInstalled,
      },
    },
  ];

  const installText = isExtensionPreInstalled
    ? `If you select Yes, the CLI will have access to your open files and display diffs directly in ${
        ideName ?? 'your editor'
      }.`
    : `If you select Yes, we'll install an extension that allows the CLI to access your open files and display diffs directly in ${
        ideName ?? 'your editor'
      }.`;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.status.warning}
      padding={1}
      width="100%"
      marginLeft={1}
    >
      <Box marginBottom={1} flexDirection="column">
        <Text>
          <Text color={theme.status.warning}>{'> '}</Text>
          {`Do you want to connect ${ideName ?? 'your editor'} to Codey?`}
        </Text>
        <Text color={theme.text.secondary}>{installText}</Text>
      </Box>
      <RadioButtonSelect items={OPTIONS} onSelect={onComplete} />
    </Box>
  );
}
