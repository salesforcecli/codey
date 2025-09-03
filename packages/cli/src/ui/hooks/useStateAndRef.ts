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

import React from 'react';

// Hook to return state, state setter, and ref to most up-to-date value of state.
// We need this in order to setState and reference the updated state multiple
// times in the same function.
export const useStateAndRef = <
  // Everything but function.
  T extends object | null | undefined | number | string,
>(
  initialValue: T,
) => {
  const [_, setState] = React.useState<T>(initialValue);
  const ref = React.useRef<T>(initialValue);

  const setStateInternal = React.useCallback<typeof setState>(
    (newStateOrCallback) => {
      let newValue: T;
      if (typeof newStateOrCallback === 'function') {
        newValue = newStateOrCallback(ref.current);
      } else {
        newValue = newStateOrCallback;
      }
      setState(newValue);
      ref.current = newValue;
    },
    [],
  );

  return [ref, setStateInternal] as const;
};
