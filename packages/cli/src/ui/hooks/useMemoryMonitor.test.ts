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

import { renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import {
  useMemoryMonitor,
  MEMORY_CHECK_INTERVAL,
  MEMORY_WARNING_THRESHOLD,
} from './useMemoryMonitor.js';
import process from 'node:process';
import { MessageType } from '../types.js';

describe('useMemoryMonitor', () => {
  const memoryUsageSpy = vi.spyOn(process, 'memoryUsage');
  const addItem = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not warn when memory usage is below threshold', () => {
    memoryUsageSpy.mockReturnValue({
      rss: MEMORY_WARNING_THRESHOLD / 2,
    } as NodeJS.MemoryUsage);
    renderHook(() => useMemoryMonitor({ addItem }));
    vi.advanceTimersByTime(10000);
    expect(addItem).not.toHaveBeenCalled();
  });

  it('should warn when memory usage is above threshold', () => {
    memoryUsageSpy.mockReturnValue({
      rss: MEMORY_WARNING_THRESHOLD * 1.5,
    } as NodeJS.MemoryUsage);
    renderHook(() => useMemoryMonitor({ addItem }));
    vi.advanceTimersByTime(MEMORY_CHECK_INTERVAL);
    expect(addItem).toHaveBeenCalledTimes(1);
    expect(addItem).toHaveBeenCalledWith(
      {
        type: MessageType.WARNING,
        text: 'High memory usage detected: 10.50 GB. If you experience a crash, please file a bug report by running `/bug`',
      },
      expect.any(Number),
    );
  });

  it('should only warn once', () => {
    memoryUsageSpy.mockReturnValue({
      rss: MEMORY_WARNING_THRESHOLD * 1.5,
    } as NodeJS.MemoryUsage);
    const { rerender } = renderHook(() => useMemoryMonitor({ addItem }));
    vi.advanceTimersByTime(MEMORY_CHECK_INTERVAL);
    expect(addItem).toHaveBeenCalledTimes(1);

    // Rerender and advance timers, should not warn again
    memoryUsageSpy.mockReturnValue({
      rss: MEMORY_WARNING_THRESHOLD * 1.5,
    } as NodeJS.MemoryUsage);
    rerender();
    vi.advanceTimersByTime(MEMORY_CHECK_INTERVAL);
    expect(addItem).toHaveBeenCalledTimes(1);
  });
});
