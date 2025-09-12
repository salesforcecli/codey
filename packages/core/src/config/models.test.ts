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
  getEffectiveModel,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_FLASH_MODEL,
  DEFAULT_GEMINI_FLASH_LITE_MODEL,
} from './models.js';

describe('getEffectiveModel', () => {
  describe('When NOT in fallback mode', () => {
    const isInFallbackMode = false;

    it('should return the Pro model when Pro is requested', () => {
      const model = getEffectiveModel(isInFallbackMode, DEFAULT_GEMINI_MODEL);
      expect(model).toBe(DEFAULT_GEMINI_MODEL);
    });

    it('should return the Flash model when Flash is requested', () => {
      const model = getEffectiveModel(
        isInFallbackMode,
        DEFAULT_GEMINI_FLASH_MODEL,
      );
      expect(model).toBe(DEFAULT_GEMINI_FLASH_MODEL);
    });

    it('should return the Lite model when Lite is requested', () => {
      const model = getEffectiveModel(
        isInFallbackMode,
        DEFAULT_GEMINI_FLASH_LITE_MODEL,
      );
      expect(model).toBe(DEFAULT_GEMINI_FLASH_LITE_MODEL);
    });

    it('should return a custom model name when requested', () => {
      const customModel = 'custom-model-v1';
      const model = getEffectiveModel(isInFallbackMode, customModel);
      expect(model).toBe(customModel);
    });
  });

  describe('When IN fallback mode', () => {
    const isInFallbackMode = true;

    it('should downgrade the Pro model to the Flash model', () => {
      const model = getEffectiveModel(isInFallbackMode, DEFAULT_GEMINI_MODEL);
      expect(model).toBe(DEFAULT_GEMINI_FLASH_MODEL);
    });

    it('should return the Flash model when Flash is requested', () => {
      const model = getEffectiveModel(
        isInFallbackMode,
        DEFAULT_GEMINI_FLASH_MODEL,
      );
      expect(model).toBe(DEFAULT_GEMINI_FLASH_MODEL);
    });

    it('should HONOR the Lite model when Lite is requested', () => {
      const model = getEffectiveModel(
        isInFallbackMode,
        DEFAULT_GEMINI_FLASH_LITE_MODEL,
      );
      expect(model).toBe(DEFAULT_GEMINI_FLASH_LITE_MODEL);
    });

    it('should HONOR any model with "lite" in its name', () => {
      const customLiteModel = 'gemini-2.5-custom-lite-vNext';
      const model = getEffectiveModel(isInFallbackMode, customLiteModel);
      expect(model).toBe(customLiteModel);
    });

    it('should downgrade any other custom model to the Flash model', () => {
      const customModel = 'custom-model-v1-unlisted';
      const model = getEffectiveModel(isInFallbackMode, customModel);
      expect(model).toBe(DEFAULT_GEMINI_FLASH_MODEL);
    });
  });
});
