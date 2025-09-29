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
import type React from 'react';
import { TrustLevel } from '../../config/trustedFolders.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { usePermissionsModifyTrust } from '../hooks/usePermissionsModifyTrust.js';
import { theme } from '../semantic-colors.js';
import { RadioButtonSelect } from './shared/RadioButtonSelect.js';
import { relaunchApp } from '../../utils/processUtils.js';
import { type UseHistoryManagerReturn } from '../hooks/useHistoryManager.js';

interface PermissionsModifyTrustDialogProps {
  onExit: () => void;
  addItem: UseHistoryManagerReturn['addItem'];
}

const TRUST_LEVEL_ITEMS = [
  {
    label: 'Trust this folder',
    value: TrustLevel.TRUST_FOLDER,
    key: TrustLevel.TRUST_FOLDER,
  },
  {
    label: 'Trust parent folder',
    value: TrustLevel.TRUST_PARENT,
    key: TrustLevel.TRUST_PARENT,
  },
  {
    label: "Don't trust",
    value: TrustLevel.DO_NOT_TRUST,
    key: TrustLevel.DO_NOT_TRUST,
  },
];

export function PermissionsModifyTrustDialog({
  onExit,
  addItem,
}: PermissionsModifyTrustDialogProps): React.JSX.Element {
  const {
    cwd,
    currentTrustLevel,
    isInheritedTrustFromParent,
    isInheritedTrustFromIde,
    needsRestart,
    updateTrustLevel,
    commitTrustLevelChange,
  } = usePermissionsModifyTrust(onExit, addItem);

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onExit();
      }
      if (needsRestart && key.name === 'r') {
        commitTrustLevelChange();
        relaunchApp();
        onExit();
      }
    },
    { isActive: true },
  );

  const index = TRUST_LEVEL_ITEMS.findIndex(
    (item) => item.value === currentTrustLevel,
  );
  const initialIndex = index === -1 ? 0 : index;

  return (
    <>
      <Box
        borderStyle="round"
        borderColor={theme.border.default}
        flexDirection="column"
        padding={1}
      >
        <Box flexDirection="column" paddingBottom={1}>
          <Text bold>{'> '}Modify Trust Level</Text>
          <Box marginTop={1} />
          <Text>Folder: {cwd}</Text>
          <Text>
            Current Level: <Text bold>{currentTrustLevel || 'Not Set'}</Text>
          </Text>
          {isInheritedTrustFromParent && (
            <Text color={theme.text.secondary}>
              Note: This folder behaves as a trusted folder because one of the
              parent folders is trusted. It will remain trusted even if you set
              a different trust level here. To change this, you need to modify
              the trust setting in the parent folder.
            </Text>
          )}
          {isInheritedTrustFromIde && (
            <Text color={theme.text.secondary}>
              Note: This folder behaves as a trusted folder because the
              connected IDE workspace is trusted. It will remain trusted even if
              you set a different trust level here.
            </Text>
          )}
        </Box>

        <RadioButtonSelect
          items={TRUST_LEVEL_ITEMS}
          onSelect={updateTrustLevel}
          isFocused={true}
          initialIndex={initialIndex}
        />
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>(Use Enter to select)</Text>
        </Box>
      </Box>
      {needsRestart && (
        <Box marginLeft={1} marginTop={1}>
          <Text color={theme.status.warning}>
            To apply the trust changes, Gemini CLI must be restarted. Press
            &apos;r&apos; to restart CLI now.
          </Text>
        </Box>
      )}
    </>
  );
}
