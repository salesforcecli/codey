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

import { useState, useEffect } from 'react';
import {
  type Extension,
  getWorkspaceExtensions,
} from '../../config/extension.js';
import { type LoadedSettings, SettingScope } from '../../config/settings.js';
import process from 'node:process';

export function useWorkspaceMigration(settings: LoadedSettings) {
  const [showWorkspaceMigrationDialog, setShowWorkspaceMigrationDialog] =
    useState(false);
  const [workspaceExtensions, setWorkspaceExtensions] = useState<Extension[]>(
    [],
  );

  useEffect(() => {
    // Default to true if not set.
    if (!(settings.merged.experimental?.extensionManagement ?? true)) {
      return;
    }
    const cwd = process.cwd();
    const extensions = getWorkspaceExtensions(cwd);
    if (
      extensions.length > 0 &&
      !settings.merged.extensions?.workspacesWithMigrationNudge?.includes(cwd)
    ) {
      setWorkspaceExtensions(extensions);
      setShowWorkspaceMigrationDialog(true);
      console.log(settings.merged.extensions);
    }
  }, [
    settings.merged.extensions,
    settings.merged.experimental?.extensionManagement,
  ]);

  const onWorkspaceMigrationDialogOpen = () => {
    const userSettings = settings.forScope(SettingScope.User);
    const extensionSettings = userSettings.settings.extensions || {
      disabled: [],
    };
    const workspacesWithMigrationNudge =
      extensionSettings.workspacesWithMigrationNudge || [];

    const cwd = process.cwd();
    if (!workspacesWithMigrationNudge.includes(cwd)) {
      workspacesWithMigrationNudge.push(cwd);
    }

    extensionSettings.workspacesWithMigrationNudge =
      workspacesWithMigrationNudge;
    settings.setValue(SettingScope.User, 'extensions', extensionSettings);
  };

  const onWorkspaceMigrationDialogClose = () => {
    setShowWorkspaceMigrationDialog(false);
  };

  return {
    showWorkspaceMigrationDialog,
    workspaceExtensions,
    onWorkspaceMigrationDialogOpen,
    onWorkspaceMigrationDialogClose,
  };
}
