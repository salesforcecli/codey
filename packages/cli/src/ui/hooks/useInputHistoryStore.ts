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

interface Logger {
  getPreviousUserMessages(): Promise<string[]>;
}

export interface UseInputHistoryStoreReturn {
  inputHistory: string[];
  addInput: (input: string) => void;
  initializeFromLogger: (logger: Logger | null) => Promise<void>;
}

/**
 * Hook for independently managing input history.
 * Completely separated from chat history and unaffected by /clear commands.
 */
export function useInputHistoryStore(): UseInputHistoryStoreReturn {
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [_pastSessionMessages, setPastSessionMessages] = useState<string[]>([]);
  const [_currentSessionMessages, setCurrentSessionMessages] = useState<
    string[]
  >([]);
  const [isInitialized, setIsInitialized] = useState(false);

  /**
   * Recalculate the complete input history from past and current sessions.
   * Applies the same deduplication logic as the previous implementation.
   */
  const recalculateHistory = useCallback(
    (currentSession: string[], pastSession: string[]) => {
      // Combine current session (newest first) + past session (newest first)
      const combinedMessages = [...currentSession, ...pastSession];

      // Deduplicate consecutive identical messages (same algorithm as before)
      const deduplicatedMessages: string[] = [];
      if (combinedMessages.length > 0) {
        deduplicatedMessages.push(combinedMessages[0]); // Add the newest one unconditionally
        for (let i = 1; i < combinedMessages.length; i++) {
          if (combinedMessages[i] !== combinedMessages[i - 1]) {
            deduplicatedMessages.push(combinedMessages[i]);
          }
        }
      }

      // Reverse to oldest first for useInputHistory
      setInputHistory(deduplicatedMessages.reverse());
    },
    [],
  );

  /**
   * Initialize input history from logger with past session data.
   * Executed only once at app startup.
   */
  const initializeFromLogger = useCallback(
    async (logger: Logger | null) => {
      if (isInitialized || !logger) return;

      try {
        const pastMessages = (await logger.getPreviousUserMessages()) || [];
        setPastSessionMessages(pastMessages); // Store as newest first
        recalculateHistory([], pastMessages);
        setIsInitialized(true);
      } catch (error) {
        // Start with empty history even if logger initialization fails
        console.warn('Failed to initialize input history from logger:', error);
        setPastSessionMessages([]);
        recalculateHistory([], []);
        setIsInitialized(true);
      }
    },
    [isInitialized, recalculateHistory],
  );

  /**
   * Add new input to history.
   * Recalculates the entire history with deduplication.
   */
  const addInput = useCallback(
    (input: string) => {
      const trimmedInput = input.trim();
      if (!trimmedInput) return; // Filter empty/whitespace-only inputs

      setCurrentSessionMessages((prevCurrent) => {
        const newCurrentSession = [...prevCurrent, trimmedInput];

        setPastSessionMessages((prevPast) => {
          recalculateHistory(
            newCurrentSession.slice().reverse(), // Convert to newest first
            prevPast,
          );
          return prevPast; // No change to past messages
        });

        return newCurrentSession;
      });
    },
    [recalculateHistory],
  );

  return {
    inputHistory,
    addInput,
    initializeFromLogger,
  };
}
