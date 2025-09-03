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
import { getProgrammingLanguage } from './telemetry-utils.js';

describe('getProgrammingLanguage', () => {
  it('should return the programming language when file_path is present', () => {
    const args = { file_path: 'src/test.ts' };
    const language = getProgrammingLanguage(args);
    expect(language).toBe('TypeScript');
  });

  it('should return the programming language when absolute_path is present', () => {
    const args = { absolute_path: 'src/test.py' };
    const language = getProgrammingLanguage(args);
    expect(language).toBe('Python');
  });

  it('should return the programming language when path is present', () => {
    const args = { path: 'src/test.go' };
    const language = getProgrammingLanguage(args);
    expect(language).toBe('Go');
  });

  it('should return undefined when no file path is present', () => {
    const args = {};
    const language = getProgrammingLanguage(args);
    expect(language).toBeUndefined();
  });

  it('should handle unknown file extensions gracefully', () => {
    const args = { file_path: 'src/test.unknown' };
    const language = getProgrammingLanguage(args);
    expect(language).toBeUndefined();
  });

  it('should handle files with no extension', () => {
    const args = { file_path: 'src/test' };
    const language = getProgrammingLanguage(args);
    expect(language).toBeUndefined();
  });
});
