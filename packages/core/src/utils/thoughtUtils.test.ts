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
import { parseThought } from './thoughtUtils.js';

describe('parseThought', () => {
  it.each([
    {
      name: 'a standard thought with subject and description',
      rawText: '**Subject:** This is the description.',
      expected: {
        subject: 'Subject:',
        description: 'This is the description.',
      },
    },
    {
      name: 'leading and trailing whitespace in the raw string',
      rawText: '  **Subject** description with spaces   ',
      expected: { subject: 'Subject', description: 'description with spaces' },
    },
    {
      name: 'whitespace surrounding the subject content',
      rawText: '** Subject  **',
      expected: { subject: 'Subject', description: '' },
    },
    {
      name: 'a thought with only a subject',
      rawText: '**Only Subject**',
      expected: { subject: 'Only Subject', description: '' },
    },
    {
      name: 'a thought with only a description (no subject)',
      rawText: 'This is just a description.',
      expected: { subject: '', description: 'This is just a description.' },
    },
    {
      name: 'an empty string input',
      rawText: '',
      expected: { subject: '', description: '' },
    },
    {
      name: 'newlines within the subject and description',
      rawText:
        '**Multi-line\nSubject**\nHere is a description\nspread across lines.',
      expected: {
        subject: 'Multi-line\nSubject',
        description: 'Here is a description\nspread across lines.',
      },
    },
    {
      name: 'only the first subject if multiple are present',
      rawText: '**First** some text **Second**',
      expected: { subject: 'First', description: 'some text **Second**' },
    },
    {
      name: 'text before and after the subject',
      rawText: 'Prefix text **Subject** Suffix text.',
      expected: {
        subject: 'Subject',
        description: 'Prefix text  Suffix text.',
      },
    },
    {
      name: 'an unclosed subject tag',
      rawText: 'Text with **an unclosed subject',
      expected: { subject: '', description: 'Text with **an unclosed subject' },
    },
    {
      name: 'an empty subject tag',
      rawText: 'A thought with **** in the middle.',
      expected: { subject: '', description: 'A thought with  in the middle.' },
    },
  ])('should correctly parse $name', ({ rawText, expected }) => {
    expect(parseThought(rawText)).toEqual(expected);
  });
});
