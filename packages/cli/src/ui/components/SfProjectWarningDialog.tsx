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
import { Colors } from '../colors.js';
import { useKeypress } from '../hooks/useKeypress.js';

interface SfProjectWarningDialogProps {
  onConfirm: () => void;
  onExit: () => void;
}

/**
 * A dialog that warns the user when required Salesforce project files are not detected
 * and requires confirmation to continue or exit.
 */
export function SfProjectWarningDialog({
  onConfirm,
  onExit,
}: SfProjectWarningDialogProps): React.JSX.Element {
  useKeypress(
    (key) => {
      if (key.name === 'return' || key.name === 'enter') {
        onConfirm();
      } else if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
        onExit();
      }
    },
    { isActive: true },
  );

  return (
    <Box
      borderStyle="round"
      borderColor={Colors.AccentYellow}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold color={Colors.AccentYellow}>
        Salesforce Project Not Detected
      </Text>
      <Box marginTop={1}>
        <Text>
          This directory does not appear to contain a valid Salesforce project.
          Codey works best in Salesforce projects with proper configuration
          files.
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text>
          You can continue, but some Salesforce-specific features may not work
          as expected.
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text color={Colors.Gray}>
          Press <Text color={Colors.AccentBlue}>Enter</Text> to continue anyway,
          or <Text color={Colors.AccentBlue}>Esc/Ctrl+C</Text> to exit
        </Text>
      </Box>
    </Box>
  );
}
