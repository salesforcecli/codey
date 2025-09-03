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

import * as url from 'node:url';
import * as path from 'node:path';

import { logger } from '../utils/logger.js';
import { main } from './app.js';

// Check if the module is the main script being run. path.resolve() creates a
// canonical, absolute path, which avoids cross-platform issues.
const isMainModule =
  path.resolve(process.argv[1]) ===
  path.resolve(url.fileURLToPath(import.meta.url));

process.on('uncaughtException', (error) => {
  logger.error('Unhandled exception:', error);
  process.exit(1);
});

if (
  import.meta.url.startsWith('file:') &&
  isMainModule &&
  process.env['NODE_ENV'] !== 'test'
) {
  main().catch((error) => {
    logger.error('[CoreAgent] Unhandled error in main:', error);
    process.exit(1);
  });
}
