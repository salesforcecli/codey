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

import { test, expect } from 'vitest';
import { ResultCache } from './result-cache.js';

test('ResultCache basic usage', async () => {
  const files = [
    'foo.txt',
    'bar.js',
    'baz.md',
    'subdir/file.txt',
    'subdir/other.js',
    'subdir/nested/file.md',
  ];
  const cache = new ResultCache(files);
  const { files: resultFiles, isExactMatch } = await cache.get('*.js');
  expect(resultFiles).toEqual(files);
  expect(isExactMatch).toBe(false);
});

test('ResultCache cache hit/miss', async () => {
  const files = ['foo.txt', 'bar.js', 'baz.md'];
  const cache = new ResultCache(files);
  // First call: miss
  const { files: result1Files, isExactMatch: isExactMatch1 } =
    await cache.get('*.js');
  expect(result1Files).toEqual(files);
  expect(isExactMatch1).toBe(false);

  // Simulate FileSearch applying the filter and setting the result
  cache.set('*.js', ['bar.js']);

  // Second call: hit
  const { files: result2Files, isExactMatch: isExactMatch2 } =
    await cache.get('*.js');
  expect(result2Files).toEqual(['bar.js']);
  expect(isExactMatch2).toBe(true);
});

test('ResultCache best base query', async () => {
  const files = ['foo.txt', 'foobar.js', 'baz.md'];
  const cache = new ResultCache(files);

  // Cache a broader query
  cache.set('foo', ['foo.txt', 'foobar.js']);

  // Search for a more specific query that starts with the broader one
  const { files: resultFiles, isExactMatch } = await cache.get('foobar');
  expect(resultFiles).toEqual(['foo.txt', 'foobar.js']);
  expect(isExactMatch).toBe(false);
});
