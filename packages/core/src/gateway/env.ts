/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
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
  const env = (process.env.SF_API_ENV || 'prod').toLowerCase();
  const allowed: SfApiEnv[] = ['prod', 'dev', 'test', 'perf', 'stage'];
  if (allowed.includes(env as SfApiEnv)) {
    return env as SfApiEnv;
  }
  return 'prod';
}
