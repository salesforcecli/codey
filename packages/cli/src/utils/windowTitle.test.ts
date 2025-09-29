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
import { computeWindowTitle } from './windowTitle.js';

describe('computeWindowTitle', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = process.env;
    vi.stubEnv('CLI_TITLE', undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should use default Gemini title when CLI_TITLE is not set', () => {
    const result = computeWindowTitle('my-project');
    expect(result).toBe('Gemini - my-project');
  });

  it('should use CLI_TITLE environment variable when set', () => {
    vi.stubEnv('CLI_TITLE', 'Custom Title');
    const result = computeWindowTitle('my-project');
    expect(result).toBe('Custom Title');
  });

  it('should remove control characters from title', () => {
    vi.stubEnv('CLI_TITLE', 'Title\x1b[31m with \x07 control chars');
    const result = computeWindowTitle('my-project');
    // The \x1b[31m (ANSI escape sequence) and \x07 (bell character) should be removed
    expect(result).toBe('Title[31m with  control chars');
  });

  it('should handle folder names with control characters', () => {
    const result = computeWindowTitle('project\x07name');
    expect(result).toBe('Gemini - projectname');
  });

  it('should handle empty folder name', () => {
    const result = computeWindowTitle('');
    expect(result).toBe('Gemini - ');
  });

  it('should handle folder names with spaces', () => {
    const result = computeWindowTitle('my project');
    expect(result).toBe('Gemini - my project');
  });

  it('should handle folder names with special characters', () => {
    const result = computeWindowTitle('project-name_v1.0');
    expect(result).toBe('Gemini - project-name_v1.0');
  });
});
