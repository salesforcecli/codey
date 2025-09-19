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

/*
 * Built-in system defaults for Codey CLI
 * These act like system-defaults.json and are the lowest-precedence layer.
 */

import type { Settings } from './settingsSchema.js';

export const BUILTIN_SYSTEM_DEFAULTS: Settings = {
  mcpServers: {
    'Salesforce DX': {
      command: 'npx',
      args: [
        '-y',
        '@salesforce/mcp@latest',
        '--orgs',
        'DEFAULT_TARGET_ORG',
        '--toolsets',
        'all',
      ],
    },
  },
};
