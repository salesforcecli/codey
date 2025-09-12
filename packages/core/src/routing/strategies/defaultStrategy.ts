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
import type {
  RoutingContext,
  RoutingDecision,
  TerminalStrategy,
} from '../routingStrategy.js';
import { DEFAULT_GEMINI_MODEL } from '../../config/models.js';

export class DefaultStrategy implements TerminalStrategy {
  readonly name = 'default';

  async route(
    _context: RoutingContext,
    _config: Config,
    _baseLlmClient: BaseLlmClient,
  ): Promise<RoutingDecision> {
    return {
      model: DEFAULT_GEMINI_MODEL,
      metadata: {
        source: this.name,
        latencyMs: 0,
        reasoning: `Routing to default model: ${DEFAULT_GEMINI_MODEL}`,
      },
    };
  }
}
