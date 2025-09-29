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

import { useState, useCallback } from 'react';
import * as process from 'node:process';
import {
  loadTrustedFolders,
  TrustLevel,
  isWorkspaceTrusted,
} from '../../config/trustedFolders.js';
import { useSettings } from '../contexts/SettingsContext.js';

import { MessageType } from '../types.js';
import { type UseHistoryManagerReturn } from './useHistoryManager.js';
import type { LoadedSettings } from '../../config/settings.js';

interface TrustState {
  currentTrustLevel: TrustLevel | undefined;
  isInheritedTrustFromParent: boolean;
  isInheritedTrustFromIde: boolean;
}

function getInitialTrustState(
  settings: LoadedSettings,
  cwd: string,
): TrustState {
  const folders = loadTrustedFolders();
  const explicitTrustLevel = folders.user.config[cwd];
  const { isTrusted, source } = isWorkspaceTrusted(settings.merged);

  const isInheritedTrust =
    isTrusted &&
    (!explicitTrustLevel || explicitTrustLevel === TrustLevel.DO_NOT_TRUST);

  return {
    currentTrustLevel: explicitTrustLevel,
    isInheritedTrustFromParent: !!(source === 'file' && isInheritedTrust),
    isInheritedTrustFromIde: !!(source === 'ide' && isInheritedTrust),
  };
}

export const usePermissionsModifyTrust = (
  onExit: () => void,
  addItem: UseHistoryManagerReturn['addItem'],
) => {
  const settings = useSettings();
  const cwd = process.cwd();

  const [initialState] = useState(() => getInitialTrustState(settings, cwd));

  const [currentTrustLevel] = useState<TrustLevel | undefined>(
    initialState.currentTrustLevel,
  );
  const [pendingTrustLevel, setPendingTrustLevel] = useState<
    TrustLevel | undefined
  >();
  const [isInheritedTrustFromParent] = useState(
    initialState.isInheritedTrustFromParent,
  );
  const [isInheritedTrustFromIde] = useState(
    initialState.isInheritedTrustFromIde,
  );
  const [needsRestart, setNeedsRestart] = useState(false);

  const isFolderTrustEnabled = !!settings.merged.security?.folderTrust?.enabled;

  const updateTrustLevel = useCallback(
    (trustLevel: TrustLevel) => {
      const wasTrusted = isWorkspaceTrusted(settings.merged).isTrusted;

      // Create a temporary config to check the new trust status without writing
      const currentConfig = loadTrustedFolders().user.config;
      const newConfig = { ...currentConfig, [cwd]: trustLevel };

      const { isTrusted, source } = isWorkspaceTrusted(
        settings.merged,
        newConfig,
      );

      if (trustLevel === TrustLevel.DO_NOT_TRUST && isTrusted) {
        let message =
          'Note: This folder is still trusted because the connected IDE workspace is trusted.';
        if (source === 'file') {
          message =
            'Note: This folder is still trusted because a parent folder is trusted.';
        }
        addItem(
          {
            type: MessageType.WARNING,
            text: message,
          },
          Date.now(),
        );
      }

      if (wasTrusted !== isTrusted) {
        setPendingTrustLevel(trustLevel);
        setNeedsRestart(true);
      } else {
        const folders = loadTrustedFolders();
        folders.setValue(cwd, trustLevel);
        onExit();
      }
    },
    [cwd, settings.merged, onExit, addItem],
  );

  const commitTrustLevelChange = useCallback(() => {
    if (pendingTrustLevel) {
      const folders = loadTrustedFolders();
      folders.setValue(cwd, pendingTrustLevel);
    }
  }, [cwd, pendingTrustLevel]);

  return {
    cwd,
    currentTrustLevel,
    isInheritedTrustFromParent,
    isInheritedTrustFromIde,
    needsRestart,
    updateTrustLevel,
    commitTrustLevelChange,
    isFolderTrustEnabled,
  };
};
