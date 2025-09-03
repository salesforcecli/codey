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

import { act, renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import { useConsoleMessages } from './useConsoleMessages';
import { useCallback } from 'react';

describe('useConsoleMessages', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  const useTestableConsoleMessages = () => {
    const { handleNewMessage, ...rest } = useConsoleMessages();
    const log = useCallback(
      (content: string) => handleNewMessage({ type: 'log', content, count: 1 }),
      [handleNewMessage],
    );
    const error = useCallback(
      (content: string) =>
        handleNewMessage({ type: 'error', content, count: 1 }),
      [handleNewMessage],
    );
    return {
      ...rest,
      log,
      error,
      clearConsoleMessages: rest.clearConsoleMessages,
    };
  };

  it('should initialize with an empty array of console messages', () => {
    const { result } = renderHook(() => useTestableConsoleMessages());
    expect(result.current.consoleMessages).toEqual([]);
  });

  it('should add a new message when log is called', async () => {
    const { result } = renderHook(() => useTestableConsoleMessages());

    act(() => {
      result.current.log('Test message');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });

    expect(result.current.consoleMessages).toEqual([
      { type: 'log', content: 'Test message', count: 1 },
    ]);
  });

  it('should batch and count identical consecutive messages', async () => {
    const { result } = renderHook(() => useTestableConsoleMessages());

    act(() => {
      result.current.log('Test message');
      result.current.log('Test message');
      result.current.log('Test message');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });

    expect(result.current.consoleMessages).toEqual([
      { type: 'log', content: 'Test message', count: 3 },
    ]);
  });

  it('should not batch different messages', async () => {
    const { result } = renderHook(() => useTestableConsoleMessages());

    act(() => {
      result.current.log('First message');
      result.current.error('Second message');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });

    expect(result.current.consoleMessages).toEqual([
      { type: 'log', content: 'First message', count: 1 },
      { type: 'error', content: 'Second message', count: 1 },
    ]);
  });

  it('should clear all messages when clearConsoleMessages is called', async () => {
    const { result } = renderHook(() => useTestableConsoleMessages());

    act(() => {
      result.current.log('A message');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });

    expect(result.current.consoleMessages).toHaveLength(1);

    act(() => {
      result.current.clearConsoleMessages();
    });

    expect(result.current.consoleMessages).toHaveLength(0);
  });

  it('should clear the pending timeout when clearConsoleMessages is called', () => {
    const { result } = renderHook(() => useTestableConsoleMessages());
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    act(() => {
      result.current.log('A message');
    });

    act(() => {
      result.current.clearConsoleMessages();
    });

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('should clean up the timeout on unmount', () => {
    const { result, unmount } = renderHook(() => useTestableConsoleMessages());
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    act(() => {
      result.current.log('A message');
    });

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});
