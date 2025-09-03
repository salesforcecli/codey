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
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useTransition,
} from 'react';
import type { ConsoleMessageItem } from '../types.js';

export interface UseConsoleMessagesReturn {
  consoleMessages: ConsoleMessageItem[];
  handleNewMessage: (message: ConsoleMessageItem) => void;
  clearConsoleMessages: () => void;
}

type Action =
  | { type: 'ADD_MESSAGES'; payload: ConsoleMessageItem[] }
  | { type: 'CLEAR' };

function consoleMessagesReducer(
  state: ConsoleMessageItem[],
  action: Action,
): ConsoleMessageItem[] {
  switch (action.type) {
    case 'ADD_MESSAGES': {
      const newMessages = [...state];
      for (const queuedMessage of action.payload) {
        const lastMessage = newMessages[newMessages.length - 1];
        if (
          lastMessage &&
          lastMessage.type === queuedMessage.type &&
          lastMessage.content === queuedMessage.content
        ) {
          // Create a new object for the last message to ensure React detects
          // the change, preventing mutation of the existing state object.
          newMessages[newMessages.length - 1] = {
            ...lastMessage,
            count: lastMessage.count + 1,
          };
        } else {
          newMessages.push({ ...queuedMessage, count: 1 });
        }
      }
      return newMessages;
    }
    case 'CLEAR':
      return [];
    default:
      return state;
  }
}

export function useConsoleMessages(): UseConsoleMessagesReturn {
  const [consoleMessages, dispatch] = useReducer(consoleMessagesReducer, []);
  const messageQueueRef = useRef<ConsoleMessageItem[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [, startTransition] = useTransition();

  const processQueue = useCallback(() => {
    if (messageQueueRef.current.length > 0) {
      const messagesToProcess = messageQueueRef.current;
      messageQueueRef.current = [];
      startTransition(() => {
        dispatch({ type: 'ADD_MESSAGES', payload: messagesToProcess });
      });
    }
    timeoutRef.current = null;
  }, []);

  const handleNewMessage = useCallback(
    (message: ConsoleMessageItem) => {
      messageQueueRef.current.push(message);
      if (!timeoutRef.current) {
        // Batch updates using a timeout. 16ms is a reasonable delay to batch
        // rapid-fire messages without noticeable lag.
        timeoutRef.current = setTimeout(processQueue, 16);
      }
    },
    [processQueue],
  );

  const clearConsoleMessages = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    messageQueueRef.current = [];
    startTransition(() => {
      dispatch({ type: 'CLEAR' });
    });
  }, []);

  // Cleanup on unmount
  useEffect(
    () => () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  return { consoleMessages, handleNewMessage, clearConsoleMessages };
}
