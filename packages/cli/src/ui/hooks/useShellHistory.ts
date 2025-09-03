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

import { useState, useEffect, useCallback } from 'react';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { isNodeError, Storage } from '@google/gemini-cli-core';

const MAX_HISTORY_LENGTH = 100;

export interface UseShellHistoryReturn {
  history: string[];
  addCommandToHistory: (command: string) => void;
  getPreviousCommand: () => string | null;
  getNextCommand: () => string | null;
  resetHistoryPosition: () => void;
}

async function getHistoryFilePath(
  projectRoot: string,
  configStorage?: Storage,
): Promise<string> {
  const storage = configStorage ?? new Storage(projectRoot);
  return storage.getHistoryFilePath();
}

// Handle multiline commands
async function readHistoryFile(filePath: string): Promise<string[]> {
  try {
    const text = await fs.readFile(filePath, 'utf-8');
    const result: string[] = [];
    let cur = '';

    for (const raw of text.split(/\r?\n/)) {
      if (!raw.trim()) continue;
      const line = raw;

      const m = cur.match(/(\\+)$/);
      if (m && m[1].length % 2) {
        // odd number of trailing '\'
        cur = cur.slice(0, -1) + ' ' + line;
      } else {
        if (cur) result.push(cur);
        cur = line;
      }
    }

    if (cur) result.push(cur);
    return result;
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') return [];
    console.error('Error reading history:', err);
    return [];
  }
}

async function writeHistoryFile(
  filePath: string,
  history: string[],
): Promise<void> {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, history.join('\n'));
  } catch (error) {
    console.error('Error writing shell history:', error);
  }
}

export function useShellHistory(
  projectRoot: string,
  storage?: Storage,
): UseShellHistoryReturn {
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [historyFilePath, setHistoryFilePath] = useState<string | null>(null);

  useEffect(() => {
    async function loadHistory() {
      const filePath = await getHistoryFilePath(projectRoot, storage);
      setHistoryFilePath(filePath);
      const loadedHistory = await readHistoryFile(filePath);
      setHistory(loadedHistory.reverse()); // Newest first
    }
    loadHistory();
  }, [projectRoot, storage]);

  const addCommandToHistory = useCallback(
    (command: string) => {
      if (!command.trim() || !historyFilePath) {
        return;
      }
      const newHistory = [command, ...history.filter((c) => c !== command)]
        .slice(0, MAX_HISTORY_LENGTH)
        .filter(Boolean);
      setHistory(newHistory);
      // Write to file in reverse order (oldest first)
      writeHistoryFile(historyFilePath, [...newHistory].reverse());
      setHistoryIndex(-1);
    },
    [history, historyFilePath],
  );

  const getPreviousCommand = useCallback(() => {
    if (history.length === 0) {
      return null;
    }
    const newIndex = Math.min(historyIndex + 1, history.length - 1);
    setHistoryIndex(newIndex);
    return history[newIndex] ?? null;
  }, [history, historyIndex]);

  const getNextCommand = useCallback(() => {
    if (historyIndex < 0) {
      return null;
    }
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    if (newIndex < 0) {
      return '';
    }
    return history[newIndex] ?? null;
  }, [history, historyIndex]);

  const resetHistoryPosition = useCallback(() => {
    setHistoryIndex(-1);
  }, []);

  return {
    history,
    addCommandToHistory,
    getPreviousCommand,
    getNextCommand,
    resetHistoryPosition,
  };
}
