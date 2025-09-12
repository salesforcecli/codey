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
import { OverrideStrategy } from './overrideStrategy.js';
import type { RoutingContext } from '../routingStrategy.js';
import type { BaseLlmClient } from '../../core/baseLlmClient.js';
import type { Config } from '../../config/config.js';

describe('OverrideStrategy', () => {
  const strategy = new OverrideStrategy();
  const mockContext = {} as RoutingContext;
  const mockClient = {} as BaseLlmClient;

  it('should return null when no override model is specified', async () => {
    const mockConfig = {
      getModel: () => '', // Simulate no model override
    } as Config;

    const decision = await strategy.route(mockContext, mockConfig, mockClient);
    expect(decision).toBeNull();
  });

  it('should return a decision with the override model when one is specified', async () => {
    const overrideModel = 'gemini-2.5-pro-custom';
    const mockConfig = {
      getModel: () => overrideModel,
    } as Config;

    const decision = await strategy.route(mockContext, mockConfig, mockClient);

    expect(decision).not.toBeNull();
    expect(decision?.model).toBe(overrideModel);
    expect(decision?.metadata.source).toBe('override');
    expect(decision?.metadata.reasoning).toContain(
      'Routing bypassed by forced model directive',
    );
    expect(decision?.metadata.reasoning).toContain(overrideModel);
  });

  it('should handle different override model names', async () => {
    const overrideModel = 'gemini-2.5-flash-experimental';
    const mockConfig = {
      getModel: () => overrideModel,
    } as Config;

    const decision = await strategy.route(mockContext, mockConfig, mockClient);

    expect(decision).not.toBeNull();
    expect(decision?.model).toBe(overrideModel);
  });
});
