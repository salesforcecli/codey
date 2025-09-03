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
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from 'react';

interface OverflowState {
  overflowingIds: ReadonlySet<string>;
}

interface OverflowActions {
  addOverflowingId: (id: string) => void;
  removeOverflowingId: (id: string) => void;
}

const OverflowStateContext = createContext<OverflowState | undefined>(
  undefined,
);

const OverflowActionsContext = createContext<OverflowActions | undefined>(
  undefined,
);

export const useOverflowState = (): OverflowState | undefined =>
  useContext(OverflowStateContext);

export const useOverflowActions = (): OverflowActions | undefined =>
  useContext(OverflowActionsContext);

export const OverflowProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [overflowingIds, setOverflowingIds] = useState(new Set<string>());

  const addOverflowingId = useCallback((id: string) => {
    setOverflowingIds((prevIds) => {
      if (prevIds.has(id)) {
        return prevIds;
      }
      const newIds = new Set(prevIds);
      newIds.add(id);
      return newIds;
    });
  }, []);

  const removeOverflowingId = useCallback((id: string) => {
    setOverflowingIds((prevIds) => {
      if (!prevIds.has(id)) {
        return prevIds;
      }
      const newIds = new Set(prevIds);
      newIds.delete(id);
      return newIds;
    });
  }, []);

  const stateValue = useMemo(
    () => ({
      overflowingIds,
    }),
    [overflowingIds],
  );

  const actionsValue = useMemo(
    () => ({
      addOverflowingId,
      removeOverflowingId,
    }),
    [addOverflowingId, removeOverflowingId],
  );

  return (
    <OverflowStateContext.Provider value={stateValue}>
      <OverflowActionsContext.Provider value={actionsValue}>
        {children}
      </OverflowActionsContext.Provider>
    </OverflowStateContext.Provider>
  );
};
