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

export * from './types.js';
export * from './base-token-storage.js';
export * from './file-token-storage.js';
export * from './hybrid-token-storage.js';

export const DEFAULT_SERVICE_NAME = 'gemini-cli-oauth';
export const FORCE_ENCRYPTED_FILE_ENV_VAR =
  'GEMINI_FORCE_ENCRYPTED_FILE_STORAGE';
