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

import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Test how paths are normalized
function testPathNormalization() {
  // Use platform-agnostic path construction instead of hardcoded paths
  const testPath = path.join('test', 'project', 'src', 'file.md');
  const absoluteTestPath = path.resolve('test', 'project', 'src', 'file.md');

  console.log('Testing path normalization:');
  console.log('Relative path:', testPath);
  console.log('Absolute path:', absoluteTestPath);

  // Test path.join with different segments
  const joinedPath = path.join('test', 'project', 'src', 'file.md');
  console.log('Joined path:', joinedPath);

  // Test path.normalize
  console.log('Normalized relative path:', path.normalize(testPath));
  console.log('Normalized absolute path:', path.normalize(absoluteTestPath));

  // Test how the test would see these paths
  const testContent = `--- File: ${absoluteTestPath} ---\nContent\n--- End of File: ${absoluteTestPath} ---`;
  console.log('\nTest content with platform-agnostic paths:');
  console.log(testContent);

  // Try to match with different patterns
  const marker = `--- File: ${absoluteTestPath} ---`;
  console.log('\nTrying to match:', marker);
  console.log('Direct match:', testContent.includes(marker));

  // Test with normalized path in marker
  const normalizedMarker = `--- File: ${path.normalize(absoluteTestPath)} ---`;
  console.log(
    'Normalized marker match:',
    testContent.includes(normalizedMarker),
  );

  // Test path resolution
  const __filename = fileURLToPath(import.meta.url);
  console.log('\nCurrent file path:', __filename);
  console.log('Directory name:', path.dirname(__filename));
}

testPathNormalization();
