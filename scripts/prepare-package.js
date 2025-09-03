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

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');

function copyFiles(packageName, filesToCopy) {
  const packageDir = path.resolve(rootDir, 'packages', packageName);
  if (!fs.existsSync(packageDir)) {
    console.error(`Error: Package directory not found at ${packageDir}`);
    process.exit(1);
  }

  console.log(`Preparing package: ${packageName}`);
  for (const [source, dest] of Object.entries(filesToCopy)) {
    const sourcePath = path.resolve(rootDir, source);
    const destPath = path.resolve(packageDir, dest);
    try {
      fs.copyFileSync(sourcePath, destPath);
      console.log(`Copied ${source} to packages/${packageName}/`);
    } catch (err) {
      console.error(`Error copying ${source}:`, err);
      process.exit(1);
    }
  }
}

// Prepare 'core' package
copyFiles('core', {
  'README.md': 'README.md',
  LICENSE: 'LICENSE',
  '.npmrc': '.npmrc',
});

// Prepare 'cli' package
copyFiles('cli', {
  'README.md': 'README.md',
  LICENSE: 'LICENSE',
});

console.log('Successfully prepared all packages.');
