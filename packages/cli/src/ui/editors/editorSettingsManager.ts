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

import {
  allowEditorTypeInSandbox,
  checkHasEditorType,
  type EditorType,
} from '@salesforce/codey-core';

export interface EditorDisplay {
  name: string;
  type: EditorType | 'not_set';
  disabled: boolean;
}

export const EDITOR_DISPLAY_NAMES: Record<EditorType, string> = {
  cursor: 'Cursor',
  emacs: 'Emacs',
  neovim: 'Neovim',
  vim: 'Vim',
  vscode: 'VS Code',
  vscodium: 'VSCodium',
  windsurf: 'Windsurf',
  zed: 'Zed',
};

class EditorSettingsManager {
  private readonly availableEditors: EditorDisplay[];

  constructor() {
    const editorTypes = Object.keys(
      EDITOR_DISPLAY_NAMES,
    ).sort() as EditorType[];
    this.availableEditors = [
      {
        name: 'None',
        type: 'not_set',
        disabled: false,
      },
      ...editorTypes.map((type) => {
        const hasEditor = checkHasEditorType(type);
        const isAllowedInSandbox = allowEditorTypeInSandbox(type);

        let labelSuffix = !isAllowedInSandbox
          ? ' (Not available in sandbox)'
          : '';
        labelSuffix = !hasEditor ? ' (Not installed)' : labelSuffix;

        return {
          name: EDITOR_DISPLAY_NAMES[type] + labelSuffix,
          type,
          disabled: !hasEditor || !isAllowedInSandbox,
        };
      }),
    ];
  }

  getAvailableEditorDisplays(): EditorDisplay[] {
    return this.availableEditors;
  }
}

export const editorSettingsManager = new EditorSettingsManager();
