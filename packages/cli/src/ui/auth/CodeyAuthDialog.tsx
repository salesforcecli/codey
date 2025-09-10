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
import { useUIActions } from '../contexts/UIActionsContext.js';
import { AuthState } from '../types.js';

/**
 * A simple informational dialog that displays the CODEY_ORG_USERNAME env var
 * and mirrors the key handling pattern used in AuthDialog.
 */
export function CodeyAuthDialog(): React.JSX.Element {
  const uiActions = useUIActions();

  // Read raw value to differentiate between set/unset, then compute a display value.
  const usernameRaw = process.env['CODEY_ORG_USERNAME'];
  const username = usernameRaw ?? 'not set';
  const isSet = Boolean(usernameRaw);

  const message = isSet ? (
    <>
      You are authorized to{' '}
      <Text color={Colors.AccentBlue}>{username}</Text>
    </>
  ) : (
    <>
      You are not authorized. Set the{' '}
      <Text color={Colors.AccentYellow}>CODEY_ORG_USERNAME</Text>
      {' '}environment variable or use the <Text color={Colors.AccentYellow}>--org</Text> flag to proceed.
    </>
  );

  useKeypress(
    (key) => {
      if (key.name === 'return' || key.name === 'enter') {
        uiActions.setAuthState(AuthState.Unauthenticated);
      } else if (key.name === 'escape') {
        uiActions.setAuthState(AuthState.Unauthenticated);
      }
    },
    { isActive: true },
  );

  return (
    <Box
      borderStyle="round"
      borderColor={Colors.Gray}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>Authorization</Text>
      <Box marginTop={1}>
        <Text>
          {message}
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text color={Colors.Gray}>(Press Enter to continue)</Text>
      </Box>
    </Box>
  );
}
