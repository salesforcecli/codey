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

import { describe, expect, it } from 'vitest';
import { getDiffStat } from './diffOptions.js';

describe('getDiffStat', () => {
  const fileName = 'test.txt';

  it('should return 0 for all stats when there are no changes', () => {
    const oldStr = 'line1\nline2\n';
    const aiStr = 'line1\nline2\n';
    const userStr = 'line1\nline2\n';
    const diffStat = getDiffStat(fileName, oldStr, aiStr, userStr);
    expect(diffStat).toEqual({
      model_added_lines: 0,
      model_removed_lines: 0,
      model_added_chars: 0,
      model_removed_chars: 0,
      user_added_lines: 0,
      user_removed_lines: 0,
      user_added_chars: 0,
      user_removed_chars: 0,
    });
  });

  it('should correctly report model additions', () => {
    const oldStr = 'line1\nline2\n';
    const aiStr = 'line1\nline2\nline3\n';
    const userStr = 'line1\nline2\nline3\n';
    const diffStat = getDiffStat(fileName, oldStr, aiStr, userStr);
    expect(diffStat).toEqual({
      model_added_lines: 1,
      model_removed_lines: 0,
      model_added_chars: 5,
      model_removed_chars: 0,
      user_added_lines: 0,
      user_removed_lines: 0,
      user_added_chars: 0,
      user_removed_chars: 0,
    });
  });

  it('should correctly report model removals', () => {
    const oldStr = 'line1\nline2\nline3\n';
    const aiStr = 'line1\nline3\n';
    const userStr = 'line1\nline3\n';
    const diffStat = getDiffStat(fileName, oldStr, aiStr, userStr);
    expect(diffStat).toEqual({
      model_added_lines: 0,
      model_removed_lines: 1,
      model_added_chars: 0,
      model_removed_chars: 5,
      user_added_lines: 0,
      user_removed_lines: 0,
      user_added_chars: 0,
      user_removed_chars: 0,
    });
  });

  it('should correctly report model modifications', () => {
    const oldStr = 'line1\nline2\nline3\n';
    const aiStr = 'line1\nline_two\nline3\n';
    const userStr = 'line1\nline_two\nline3\n';
    const diffStat = getDiffStat(fileName, oldStr, aiStr, userStr);
    expect(diffStat).toEqual({
      model_added_lines: 1,
      model_removed_lines: 1,
      model_added_chars: 8,
      model_removed_chars: 5,
      user_added_lines: 0,
      user_removed_lines: 0,
      user_added_chars: 0,
      user_removed_chars: 0,
    });
  });

  it('should correctly report user additions', () => {
    const oldStr = 'line1\nline2\n';
    const aiStr = 'line1\nline2\nline3\n';
    const userStr = 'line1\nline2\nline3\nline4\n';
    const diffStat = getDiffStat(fileName, oldStr, aiStr, userStr);
    expect(diffStat).toEqual({
      model_added_lines: 1,
      model_removed_lines: 0,
      model_added_chars: 5,
      model_removed_chars: 0,
      user_added_lines: 1,
      user_removed_lines: 0,
      user_added_chars: 5,
      user_removed_chars: 0,
    });
  });

  it('should correctly report user removals', () => {
    const oldStr = 'line1\nline2\n';
    const aiStr = 'line1\nline2\nline3\n';
    const userStr = 'line1\nline2\n';
    const diffStat = getDiffStat(fileName, oldStr, aiStr, userStr);
    expect(diffStat).toEqual({
      model_added_lines: 1,
      model_removed_lines: 0,
      model_added_chars: 5,
      model_removed_chars: 0,
      user_added_lines: 0,
      user_removed_lines: 1,
      user_added_chars: 0,
      user_removed_chars: 5,
    });
  });

  it('should correctly report user modifications', () => {
    const oldStr = 'line1\nline2\n';
    const aiStr = 'line1\nline2\nline3\n';
    const userStr = 'line1\nline2\nline_three\n';
    const diffStat = getDiffStat(fileName, oldStr, aiStr, userStr);
    expect(diffStat).toEqual({
      model_added_lines: 1,
      model_removed_lines: 0,
      model_added_chars: 5,
      model_removed_chars: 0,
      user_added_lines: 1,
      user_removed_lines: 1,
      user_added_chars: 10,
      user_removed_chars: 5,
    });
  });

  it('should handle complex changes from both model and user', () => {
    const oldStr = 'line1\nline2\nline3\nline4\n';
    const aiStr = 'line_one\nline2\nline_three\nline4\n';
    const userStr = 'line_one\nline_two\nline_three\nline4\nline5\n';
    const diffStat = getDiffStat(fileName, oldStr, aiStr, userStr);
    expect(diffStat).toEqual({
      model_added_lines: 2,
      model_removed_lines: 2,
      model_added_chars: 18,
      model_removed_chars: 10,
      user_added_lines: 2,
      user_removed_lines: 1,
      user_added_chars: 13,
      user_removed_chars: 5,
    });
  });

  it('should report a single line modification as one addition and one removal', () => {
    const oldStr = 'hello world';
    const aiStr = 'hello universe';
    const userStr = 'hello universe';
    const diffStat = getDiffStat(fileName, oldStr, aiStr, userStr);
    expect(diffStat).toEqual({
      model_added_lines: 1,
      model_removed_lines: 1,
      model_added_chars: 14,
      model_removed_chars: 11,
      user_added_lines: 0,
      user_removed_lines: 0,
      user_added_chars: 0,
      user_removed_chars: 0,
    });
  });
});
