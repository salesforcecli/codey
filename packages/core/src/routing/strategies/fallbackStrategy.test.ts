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
import { FallbackStrategy } from './fallbackStrategy.js';
import type { RoutingContext } from '../routingStrategy.js';
import type { BaseLlmClient } from '../../core/baseLlmClient.js';
import type { Config } from '../../config/config.js';
import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_FLASH_MODEL,
  DEFAULT_GEMINI_FLASH_LITE_MODEL,
} from '../../config/models.js';

describe('FallbackStrategy', () => {
  const strategy = new FallbackStrategy();
  const mockContext = {} as RoutingContext;
  const mockClient = {} as BaseLlmClient;

  it('should return null when not in fallback mode', async () => {
    const mockConfig = {
      isInFallbackMode: () => false,
      getModel: () => DEFAULT_GEMINI_MODEL,
    } as Config;

    const decision = await strategy.route(mockContext, mockConfig, mockClient);
    expect(decision).toBeNull();
  });

  describe('when in fallback mode', () => {
    it('should downgrade a pro model to the flash model', async () => {
      const mockConfig = {
        isInFallbackMode: () => true,
        getModel: () => DEFAULT_GEMINI_MODEL,
      } as Config;

      const decision = await strategy.route(
        mockContext,
        mockConfig,
        mockClient,
      );

      expect(decision).not.toBeNull();
      expect(decision?.model).toBe(DEFAULT_GEMINI_FLASH_MODEL);
      expect(decision?.metadata.source).toBe('fallback');
      expect(decision?.metadata.reasoning).toContain('In fallback mode');
    });

    it.skip('should honor a lite model request', async () => {
      const mockConfig = {
        isInFallbackMode: () => true,
        getModel: () => DEFAULT_GEMINI_FLASH_LITE_MODEL,
      } as Config;

      const decision = await strategy.route(
        mockContext,
        mockConfig,
        mockClient,
      );

      expect(decision).not.toBeNull();
      expect(decision?.model).toBe(DEFAULT_GEMINI_FLASH_LITE_MODEL);
      expect(decision?.metadata.source).toBe('fallback');
    });

    it('should use the flash model if flash is requested', async () => {
      const mockConfig = {
        isInFallbackMode: () => true,
        getModel: () => DEFAULT_GEMINI_FLASH_MODEL,
      } as Config;

      const decision = await strategy.route(
        mockContext,
        mockConfig,
        mockClient,
      );

      expect(decision).not.toBeNull();
      expect(decision?.model).toBe(DEFAULT_GEMINI_FLASH_MODEL);
      expect(decision?.metadata.source).toBe('fallback');
    });
  });
});
