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

import { useEffect, useCallback } from 'react';
import { useCompletion } from './useCompletion.js';
import type { TextBuffer } from '../components/shared/text-buffer.js';
import type { Suggestion } from '../components/SuggestionsDisplay.js';

export interface UseReverseSearchCompletionReturn {
  suggestions: Suggestion[];
  activeSuggestionIndex: number;
  visibleStartIndex: number;
  showSuggestions: boolean;
  isLoadingSuggestions: boolean;
  navigateUp: () => void;
  navigateDown: () => void;
  handleAutocomplete: (i: number) => void;
  resetCompletionState: () => void;
}

export function useReverseSearchCompletion(
  buffer: TextBuffer,
  shellHistory: readonly string[],
  reverseSearchActive: boolean,
): UseReverseSearchCompletionReturn {
  const {
    suggestions,
    activeSuggestionIndex,
    visibleStartIndex,
    showSuggestions,
    isLoadingSuggestions,

    setSuggestions,
    setShowSuggestions,
    setActiveSuggestionIndex,
    resetCompletionState,
    navigateUp,
    navigateDown,
  } = useCompletion();

  useEffect(() => {
    if (!reverseSearchActive) {
      resetCompletionState();
    }
  }, [reverseSearchActive, resetCompletionState]);

  useEffect(() => {
    if (!reverseSearchActive) {
      return;
    }

    const q = buffer.text.toLowerCase();
    const matches = shellHistory.reduce<Suggestion[]>((acc, cmd) => {
      const idx = cmd.toLowerCase().indexOf(q);
      if (idx !== -1) {
        acc.push({ label: cmd, value: cmd, matchedIndex: idx });
      }
      return acc;
    }, []);

    setSuggestions(matches);
    setShowSuggestions(matches.length > 0);
    setActiveSuggestionIndex(matches.length > 0 ? 0 : -1);
  }, [
    buffer.text,
    shellHistory,
    reverseSearchActive,
    setActiveSuggestionIndex,
    setShowSuggestions,
    setSuggestions,
  ]);

  const handleAutocomplete = useCallback(
    (i: number) => {
      if (i < 0 || i >= suggestions.length) return;
      buffer.setText(suggestions[i].value);
      resetCompletionState();
    },
    [buffer, suggestions, resetCompletionState],
  );

  return {
    suggestions,
    activeSuggestionIndex,
    visibleStartIndex,
    showSuggestions,
    isLoadingSuggestions,
    navigateUp,
    navigateDown,
    handleAutocomplete,
    resetCompletionState,
  };
}
