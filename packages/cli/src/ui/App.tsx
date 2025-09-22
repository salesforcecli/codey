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
import { StreamingContext } from './contexts/StreamingContext.js';
import { Notifications } from './components/Notifications.js';
import { MainContent } from './components/MainContent.js';
import { DialogManager } from './components/DialogManager.js';
import { Composer } from './components/Composer.js';
import { useUIState } from './contexts/UIStateContext.js';
import { QuittingDisplay } from './components/QuittingDisplay.js';
import { theme } from './semantic-colors.js';

export const App = () => {
  const uiState = useUIState();

  if (uiState.quittingMessages) {
    return <QuittingDisplay />;
  }

  return (
    <StreamingContext.Provider value={uiState.streamingState}>
      <Box flexDirection="column" width="90%">
        <MainContent />

        <Box flexDirection="column" ref={uiState.mainControlsRef}>
          <Notifications />

          {uiState.dialogsVisible ? <DialogManager /> : <Composer />}

          {uiState.dialogsVisible && uiState.ctrlCPressedOnce && (
            <Box marginTop={1}>
              <Text color={theme.status.warning}>
                Press Ctrl+C again to exit.
              </Text>
            </Box>
          )}

          {uiState.dialogsVisible && uiState.ctrlDPressedOnce && (
            <Box marginTop={1}>
              <Text color={theme.status.warning}>
                Press Ctrl+D again to exit.
              </Text>
            </Box>
          )}
        </Box>
      </Box>
    </StreamingContext.Provider>
  );
};
