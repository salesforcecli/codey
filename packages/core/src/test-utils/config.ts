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

import type { ConfigParameters } from '../config/config.js';
import { Config } from '../config/config.js';

/**
 * Default parameters used for {@link FAKE_CONFIG}
 */
export const DEFAULT_CONFIG_PARAMETERS: ConfigParameters = {
  usageStatisticsEnabled: true,
  debugMode: false,
  sessionId: 'test-session-id',
  proxy: undefined,
  model: 'gemini-9001-super-duper',
  targetDir: '/',
  cwd: '/',
};

/**
 * Produces a config.  Default paramters are set to
 * {@link DEFAULT_CONFIG_PARAMETERS}, optionally, fields can be specified to
 * override those defaults.
 */
export function makeFakeConfig(
  config: Partial<ConfigParameters> = {
    ...DEFAULT_CONFIG_PARAMETERS,
  },
): Config {
  return new Config({
    ...DEFAULT_CONFIG_PARAMETERS,
    ...config,
  });
}
