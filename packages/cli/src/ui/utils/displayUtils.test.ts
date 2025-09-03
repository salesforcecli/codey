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

import { describe, it, expect } from 'vitest';
import {
  getStatusColor,
  TOOL_SUCCESS_RATE_HIGH,
  TOOL_SUCCESS_RATE_MEDIUM,
  USER_AGREEMENT_RATE_HIGH,
  USER_AGREEMENT_RATE_MEDIUM,
  CACHE_EFFICIENCY_HIGH,
  CACHE_EFFICIENCY_MEDIUM,
} from './displayUtils.js';
import { Colors } from '../colors.js';

describe('displayUtils', () => {
  describe('getStatusColor', () => {
    const thresholds = {
      green: 80,
      yellow: 50,
    };

    it('should return green for values >= green threshold', () => {
      expect(getStatusColor(90, thresholds)).toBe(Colors.AccentGreen);
      expect(getStatusColor(80, thresholds)).toBe(Colors.AccentGreen);
    });

    it('should return yellow for values < green and >= yellow threshold', () => {
      expect(getStatusColor(79, thresholds)).toBe(Colors.AccentYellow);
      expect(getStatusColor(50, thresholds)).toBe(Colors.AccentYellow);
    });

    it('should return red for values < yellow threshold', () => {
      expect(getStatusColor(49, thresholds)).toBe(Colors.AccentRed);
      expect(getStatusColor(0, thresholds)).toBe(Colors.AccentRed);
    });

    it('should return defaultColor for values < yellow threshold when provided', () => {
      expect(
        getStatusColor(49, thresholds, { defaultColor: Colors.Foreground }),
      ).toBe(Colors.Foreground);
    });
  });

  describe('Threshold Constants', () => {
    it('should have the correct values', () => {
      expect(TOOL_SUCCESS_RATE_HIGH).toBe(95);
      expect(TOOL_SUCCESS_RATE_MEDIUM).toBe(85);
      expect(USER_AGREEMENT_RATE_HIGH).toBe(75);
      expect(USER_AGREEMENT_RATE_MEDIUM).toBe(45);
      expect(CACHE_EFFICIENCY_HIGH).toBe(40);
      expect(CACHE_EFFICIENCY_MEDIUM).toBe(15);
    });
  });
});
