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

import type { GeminiCLIExtension } from '@salesforce/codey-core';
import { getErrorMessage } from '../../utils/errors.js';
import { ExtensionUpdateState } from '../state/extensions.js';
import { useMemo, useState } from 'react';
import type { UseHistoryManagerReturn } from './useHistoryManager.js';
import { MessageType } from '../types.js';
import {
  checkForAllExtensionUpdates,
  updateExtension,
} from '../../config/extensions/update.js';

export const useExtensionUpdates = (
  extensions: GeminiCLIExtension[],
  addItem: UseHistoryManagerReturn['addItem'],
  cwd: string,
) => {
  const [extensionsUpdateState, setExtensionsUpdateState] = useState(
    new Map<string, ExtensionUpdateState>(),
  );
  useMemo(() => {
    const checkUpdates = async () => {
      const updateState = await checkForAllExtensionUpdates(
        extensions,
        extensionsUpdateState,
        setExtensionsUpdateState,
      );
      for (const extension of extensions) {
        const prevState = extensionsUpdateState.get(extension.name);
        const currentState = updateState.get(extension.name);
        if (
          prevState === currentState ||
          currentState !== ExtensionUpdateState.UPDATE_AVAILABLE
        ) {
          continue;
        }
        if (extension.installMetadata?.autoUpdate) {
          updateExtension(extension, cwd, currentState, (newState) => {
            setExtensionsUpdateState((prev) => {
              const finalState = new Map(prev);
              finalState.set(extension.name, newState);
              return finalState;
            });
          })
            .then((result) => {
              if (!result) return;
              addItem(
                {
                  type: MessageType.INFO,
                  text: `Extension "${extension.name}" successfully updated: ${result.originalVersion} → ${result.updatedVersion}.`,
                },
                Date.now(),
              );
            })
            .catch((error) => {
              console.error(
                `Error updating extension "${extension.name}": ${getErrorMessage(error)}.`,
              );
            });
        } else {
          addItem(
            {
              type: MessageType.INFO,
              text: `Extension ${extension.name} has an update available, run "/extensions update ${extension.name}" to install it.`,
            },
            Date.now(),
          );
        }
      }
    };
    checkUpdates();
  }, [
    extensions,
    extensionsUpdateState,
    setExtensionsUpdateState,
    addItem,
    cwd,
  ]);
  return {
    extensionsUpdateState,
    setExtensionsUpdateState,
  };
};
