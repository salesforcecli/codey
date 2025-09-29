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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getStartupWarnings } from './startupWarnings.js';
import * as fs from 'node:fs/promises';
import { getErrorMessage } from '@salesforce/codey-core';

vi.mock('node:fs/promises', { spy: true });
vi.mock('@salesforce/codey-core', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@salesforce/codey-core')>();
  return {
    ...actual,
    getErrorMessage: vi.fn(),
  };
});

describe('startupWarnings', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return warnings from the file and delete it', async () => {
    const mockWarnings = 'Warning 1\nWarning 2';
    vi.mocked(fs.access).mockResolvedValue();
    vi.mocked(fs.readFile).mockResolvedValue(mockWarnings);
    vi.mocked(fs.unlink).mockResolvedValue();

    const warnings = await getStartupWarnings();

    expect(fs.access).toHaveBeenCalled();
    expect(fs.readFile).toHaveBeenCalled();
    expect(fs.unlink).toHaveBeenCalled();
    expect(warnings).toEqual(['Warning 1', 'Warning 2']);
  });

  it('should return an empty array if the file does not exist', async () => {
    const error = new Error('File not found');
    (error as Error & { code: string }).code = 'ENOENT';
    vi.mocked(fs.access).mockRejectedValue(error);

    const warnings = await getStartupWarnings();

    expect(warnings).toEqual([]);
  });

  it('should return an error message if reading the file fails', async () => {
    const error = new Error('Permission denied');
    vi.mocked(fs.access).mockRejectedValue(error);
    vi.mocked(getErrorMessage).mockReturnValue('Permission denied');

    const warnings = await getStartupWarnings();

    expect(warnings).toEqual([
      'Error checking/reading warnings file: Permission denied',
    ]);
  });

  it('should return a warning if deleting the file fails', async () => {
    const mockWarnings = 'Warning 1';
    vi.mocked(fs.access).mockResolvedValue();
    vi.mocked(fs.readFile).mockResolvedValue(mockWarnings);
    vi.mocked(fs.unlink).mockRejectedValue(new Error('Permission denied'));

    const warnings = await getStartupWarnings();

    expect(warnings).toEqual([
      'Warning 1',
      'Warning: Could not delete temporary warnings file.',
    ]);
  });
});
