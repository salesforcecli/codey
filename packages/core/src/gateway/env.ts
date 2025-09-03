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

type SfApiEnv = 'prod' | 'dev' | 'test' | 'perf' | 'stage';

export function getSalesforceBaseUrl(env: SfApiEnv = 'prod'): string {
  switch (env) {
    case 'dev':
      return 'https://dev.api.salesforce.com';
    case 'test':
      return 'https://test.api.salesforce.com';
    case 'perf':
      return 'https://perf.api.salesforce.com';
    case 'stage':
      return 'https://stage.api.salesforce.com';
    case 'prod':
    default:
      return 'https://api.salesforce.com';
  }
}

export function getSalesforceRegionHeader(env: SfApiEnv = 'prod'): string {
  // Mapping aligned with VS Code integration heuristics
  switch (env) {
    case 'prod':
      return 'EAST_REGION_1';
    case 'stage':
      return 'EAST_REGION_2';
    case 'dev':
    case 'test':
    case 'perf':
    default:
      return 'WEST_REGION';
  }
}

export function resolveSfApiEnv(): SfApiEnv {
  const env = (process.env['SF_API_ENV'] || 'prod').toLowerCase();
  const allowed: SfApiEnv[] = ['prod', 'dev', 'test', 'perf', 'stage'];
  if (allowed.includes(env as SfApiEnv)) {
    return env as SfApiEnv;
  }
  return 'prod';
}
