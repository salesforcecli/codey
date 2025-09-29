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

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useModelCommand } from './useModelCommand.js';

describe('useModelCommand', () => {
  it('should initialize with the model dialog closed', () => {
    const { result } = renderHook(() => useModelCommand());
    expect(result.current.isModelDialogOpen).toBe(false);
  });

  it('should open the model dialog when openModelDialog is called', () => {
    const { result } = renderHook(() => useModelCommand());

    act(() => {
      result.current.openModelDialog();
    });

    expect(result.current.isModelDialogOpen).toBe(true);
  });

  it('should close the model dialog when closeModelDialog is called', () => {
    const { result } = renderHook(() => useModelCommand());

    // Open it first
    act(() => {
      result.current.openModelDialog();
    });
    expect(result.current.isModelDialogOpen).toBe(true);

    // Then close it
    act(() => {
      result.current.closeModelDialog();
    });
    expect(result.current.isModelDialogOpen).toBe(false);
  });
});
