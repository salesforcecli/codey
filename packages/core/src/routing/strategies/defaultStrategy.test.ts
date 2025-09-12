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
import { DefaultStrategy } from './defaultStrategy.js';
import type { RoutingContext } from '../routingStrategy.js';
import type { BaseLlmClient } from '../../core/baseLlmClient.js';
import { DEFAULT_GEMINI_MODEL } from '../../config/models.js';
import type { Config } from '../../config/config.js';

describe('DefaultStrategy', () => {
  it('should always route to the default Gemini model', async () => {
    const strategy = new DefaultStrategy();
    const mockContext = {} as RoutingContext;
    const mockConfig = {} as Config;
    const mockClient = {} as BaseLlmClient;

    const decision = await strategy.route(mockContext, mockConfig, mockClient);

    expect(decision).toEqual({
      model: DEFAULT_GEMINI_MODEL,
      metadata: {
        source: 'default',
        latencyMs: 0,
        reasoning: `Routing to default model: ${DEFAULT_GEMINI_MODEL}`,
      },
    });
  });
});
