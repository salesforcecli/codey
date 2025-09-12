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

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { IdeClient, ideContextStore } from '@salesforce/codey-core';

/**
 * This hook listens for trust status updates from the IDE companion extension.
 * It provides the current trust status from the IDE and a flag indicating
 * if a restart is needed because the trust state has changed.
 */
export function useIdeTrustListener() {
  const subscribe = useCallback((onStoreChange: () => void) => {
    (async () => {
      const ideClient = await IdeClient.getInstance();
      ideClient.addTrustChangeListener(onStoreChange);
    })();
    return () => {
      (async () => {
        const ideClient = await IdeClient.getInstance();
        ideClient.removeTrustChangeListener(onStoreChange);
      })();
    };
  }, []);

  const getSnapshot = () => ideContextStore.get()?.workspaceState?.isTrusted;

  const isIdeTrusted = useSyncExternalStore(subscribe, getSnapshot);

  const [needsRestart, setNeedsRestart] = useState(false);
  const [initialTrustValue] = useState(isIdeTrusted);

  useEffect(() => {
    if (
      !needsRestart &&
      initialTrustValue !== undefined &&
      initialTrustValue !== isIdeTrusted
    ) {
      setNeedsRestart(true);
    }
  }, [isIdeTrusted, initialTrustValue, needsRestart]);

  return { isIdeTrusted, needsRestart };
}
