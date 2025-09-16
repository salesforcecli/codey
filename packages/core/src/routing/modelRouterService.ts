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

import type { Config } from '../config/config.js';
import type {
  RoutingContext,
  RoutingDecision,
  TerminalStrategy,
} from './routingStrategy.js';
import { DefaultStrategy } from './strategies/defaultStrategy.js';
import { ClassifierStrategy } from './strategies/classifierStrategy.js';
import { CompositeStrategy } from './strategies/compositeStrategy.js';
import { FallbackStrategy } from './strategies/fallbackStrategy.js';
import { OverrideStrategy } from './strategies/overrideStrategy.js';

/**
 * A centralized service for making model routing decisions.
 */
export class ModelRouterService {
  private config: Config;
  private strategy: TerminalStrategy;

  constructor(config: Config) {
    this.config = config;
    this.strategy = this.initializeDefaultStrategy();
  }

  private initializeDefaultStrategy(): TerminalStrategy {
    // Initialize the composite strategy with the desired priority order.
    // The strategies are ordered in order of highest priority.
    return new CompositeStrategy(
      [
        new FallbackStrategy(),
        new OverrideStrategy(),
        new ClassifierStrategy(),
        new DefaultStrategy(),
      ],
      'agent-router',
    );
  }

  /**
   * Determines which model to use for a given request context.
   *
   * @param context The full context of the request.
   * @returns A promise that resolves to a RoutingDecision.
   */
  async route(context: RoutingContext): Promise<RoutingDecision> {
    const decision = await this.strategy.route(
      context,
      this.config,
      this.config.getBaseLlmClient(),
    );

    return decision;
  }
}
