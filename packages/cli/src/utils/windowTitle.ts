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

/**
 * Computes the window title for the Gemini CLI application.
 *
 * @param folderName - The name of the current folder/workspace to display in the title
 * @returns The computed window title, either from CLI_TITLE environment variable or the default Gemini title
 */
export function computeWindowTitle(folderName: string): string {
  const title = process.env['CLI_TITLE'] || `Codey - ${folderName}`;

  // Remove control characters that could cause issues in terminal titles
  return title.replace(
    // eslint-disable-next-line no-control-regex
    /[\x00-\x1F\x7F]/g,
    '',
  );
}
