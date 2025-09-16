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

import * as fs from 'node:fs';
import { parse, stringify } from 'comment-json';

/**
 * Updates a JSON file while preserving comments and formatting.
 */
export function updateSettingsFilePreservingFormat(
  filePath: string,
  updates: Record<string, unknown>,
): void {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(updates, null, 2), 'utf-8');
    return;
  }

  const originalContent = fs.readFileSync(filePath, 'utf-8');

  let parsed: Record<string, unknown>;
  try {
    parsed = parse(originalContent) as Record<string, unknown>;
  } catch (error) {
    console.error('Error parsing settings file:', error);
    console.error(
      'Settings file may be corrupted. Please check the JSON syntax.',
    );
    return;
  }

  const updatedStructure = applyUpdates(parsed, updates);
  const updatedContent = stringify(updatedStructure, null, 2);

  fs.writeFileSync(filePath, updatedContent, 'utf-8');
}

function applyUpdates(
  current: Record<string, unknown>,
  updates: Record<string, unknown>,
): Record<string, unknown> {
  const result = current;

  for (const key of Object.getOwnPropertyNames(updates)) {
    const value = updates[key];
    if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      typeof result[key] === 'object' &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = applyUpdates(
        result[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}
