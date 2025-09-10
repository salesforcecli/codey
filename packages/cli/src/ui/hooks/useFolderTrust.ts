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

import { useState, useCallback, useEffect } from 'react';
import type { LoadedSettings } from '../../config/settings.js';
import { FolderTrustChoice } from '../components/FolderTrustDialog.js';
import {
  loadTrustedFolders,
  TrustLevel,
  isWorkspaceTrusted,
} from '../../config/trustedFolders.js';
import * as process from 'node:process';

export const useFolderTrust = (
  settings: LoadedSettings,
  onTrustChange: (isTrusted: boolean | undefined) => void,
  refreshStatic: () => void,
) => {
  const [isTrusted, setIsTrusted] = useState<boolean | undefined>(undefined);
  const [isFolderTrustDialogOpen, setIsFolderTrustDialogOpen] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

  const folderTrust = settings.merged.security?.folderTrust?.enabled;

  useEffect(() => {
    const trusted = isWorkspaceTrusted(settings.merged);
    setIsTrusted(trusted);
    setIsFolderTrustDialogOpen(trusted === undefined);
    onTrustChange(trusted);
  }, [folderTrust, onTrustChange, settings.merged]);

  useEffect(() => {
    // When the folder trust dialog is about to open/close, we need to force a refresh
    // of the static content to ensure the Tips are hidden/shown correctly.
    refreshStatic();
  }, [isFolderTrustDialogOpen, refreshStatic]);

  const handleFolderTrustSelect = useCallback(
    (choice: FolderTrustChoice) => {
      const trustedFolders = loadTrustedFolders();
      const cwd = process.cwd();
      let trustLevel: TrustLevel;

      const wasTrusted = isTrusted ?? true;

      switch (choice) {
        case FolderTrustChoice.TRUST_FOLDER:
          trustLevel = TrustLevel.TRUST_FOLDER;
          break;
        case FolderTrustChoice.TRUST_PARENT:
          trustLevel = TrustLevel.TRUST_PARENT;
          break;
        case FolderTrustChoice.DO_NOT_TRUST:
          trustLevel = TrustLevel.DO_NOT_TRUST;
          break;
        default:
          return;
      }

      trustedFolders.setValue(cwd, trustLevel);
      const currentIsTrusted =
        trustLevel === TrustLevel.TRUST_FOLDER ||
        trustLevel === TrustLevel.TRUST_PARENT;
      setIsTrusted(currentIsTrusted);
      onTrustChange(currentIsTrusted);

      const needsRestart = wasTrusted !== currentIsTrusted;
      if (needsRestart) {
        setIsRestarting(true);
        setIsFolderTrustDialogOpen(true);
      } else {
        setIsFolderTrustDialogOpen(false);
      }
    },
    [onTrustChange, isTrusted],
  );

  return {
    isTrusted,
    isFolderTrustDialogOpen,
    handleFolderTrustSelect,
    isRestarting,
  };
};
