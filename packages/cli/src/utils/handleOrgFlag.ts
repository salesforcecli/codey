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

import type { LoadedSettings } from '../config/settings.js';

/**
 * Handles the --org flag by setting the appropriate environment variable and validating authentication configuration.
 *
 * This function sets the CODEY_GATEWAY_ORG environment variable based on the provided org parameter,
 * falling back to existing environment variables. It validates that either CODEY_GATEWAY_ORG or
 * GEMINI_API_KEY is available for authentication, and refreshes the settings to trigger auth type
 * auto-selection.
 *
 * @param org - The organization username to use, or undefined to use existing environment variable
 * @param settings - The loaded settings instance that will be refreshed after environment setup
 * @throws Will exit the process with code 1 if neither CODEY_GATEWAY_ORG nor GEMINI_API_KEY is available
 *
 * @remarks
 * A better solution would be to set the org in the Config instance directly. However, this approach
 * minimizes changes to other parts of the code, making it easier to stay in sync with upstream changes.
 */
export function handleOrgFlag(
  org: string | undefined,
  settings: LoadedSettings,
): void {
  process.env['CODEY_GATEWAY_ORG'] =
    org ?? process.env['CODEY_GATEWAY_ORG'] ?? '';
  // Do not throw if either CODEY_GATEWAY_ORG or GEMINI_API_KEY is set
  if (!process.env['CODEY_GATEWAY_ORG'] && !process.env['GEMINI_API_KEY']) {
    console.error(
      'Error: No org specified. Please provide an org using the --gateway-org flag or set the CODEY_GATEWAY_ORG environment variable.',
    );
    process.exit(1);
  }

  // Refresh settings after setting env var to trigger auth type auto-selection
  settings.refresh();
}
