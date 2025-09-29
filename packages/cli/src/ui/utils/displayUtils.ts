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

import { theme } from '../semantic-colors.js';

// --- Thresholds ---
export const TOOL_SUCCESS_RATE_HIGH = 95;
export const TOOL_SUCCESS_RATE_MEDIUM = 85;

export const USER_AGREEMENT_RATE_HIGH = 75;
export const USER_AGREEMENT_RATE_MEDIUM = 45;

export const CACHE_EFFICIENCY_HIGH = 40;
export const CACHE_EFFICIENCY_MEDIUM = 15;

// --- Color Logic ---
export const getStatusColor = (
  value: number,
  thresholds: { green: number; yellow: number },
  options: { defaultColor?: string } = {},
) => {
  if (value >= thresholds.green) {
    return theme.status.success;
  }
  if (value >= thresholds.yellow) {
    return theme.status.warning;
  }
  return options.defaultColor ?? theme.status.error;
};
