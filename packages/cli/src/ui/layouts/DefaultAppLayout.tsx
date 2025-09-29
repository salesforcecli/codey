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
import { Box } from 'ink';
import { Notifications } from '../components/Notifications.js';
import { MainContent } from '../components/MainContent.js';
import { DialogManager } from '../components/DialogManager.js';
import { Composer } from '../components/Composer.js';
import { ExitWarning } from '../components/ExitWarning.js';
import { useUIState } from '../contexts/UIStateContext.js';

export const DefaultAppLayout: React.FC = () => {
  const uiState = useUIState();

  return (
    <Box flexDirection="column" width="90%">
      <MainContent />

      <Box flexDirection="column" ref={uiState.mainControlsRef}>
        <Notifications />

        {uiState.dialogsVisible ? (
          <DialogManager addItem={uiState.historyManager.addItem} />
        ) : (
          <Composer />
        )}

        <ExitWarning />
      </Box>
    </Box>
  );
};
