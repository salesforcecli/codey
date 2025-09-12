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

import type { Config } from '../../config/config.js';
import type { BaseLlmClient } from '../../core/baseLlmClient.js';
import { getModel } from '../../core/getModel.js';
import type {
  RoutingContext,
  RoutingDecision,
  RoutingStrategy,
} from '../routingStrategy.js';

export class FallbackStrategy implements RoutingStrategy {
  readonly name = 'fallback';

  async route(
    _context: RoutingContext,
    config: Config,
    _baseLlmClient: BaseLlmClient,
  ): Promise<RoutingDecision | null> {
    const isInFallbackMode: boolean = config.isInFallbackMode();

    if (!isInFallbackMode) {
      return null;
    }

    const effectiveModel = isInFallbackMode
      ? getModel('fallback')
      : config.getModel();

    return {
      model: effectiveModel,
      metadata: {
        source: this.name,
        latencyMs: 0,
        reasoning: `In fallback mode. Using: ${effectiveModel}`,
      },
    };
  }
}
