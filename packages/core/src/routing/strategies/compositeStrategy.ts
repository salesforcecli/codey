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
  RoutingStrategy,
  TerminalStrategy,
} from '../routingStrategy.js';

/**
 * A strategy that attempts a list of child strategies in order (Chain of Responsibility).
 */
export class CompositeStrategy implements TerminalStrategy {
  readonly name: string;

  private strategies: [...RoutingStrategy[], TerminalStrategy];

  /**
   * Initializes the CompositeStrategy.
   * @param strategies The strategies to try, in order of priority. The last strategy must be terminal.
   * @param name The name of this composite configuration (e.g., 'router' or 'composite').
   */
  constructor(
    strategies: [...RoutingStrategy[], TerminalStrategy],
    name: string = 'composite',
  ) {
    this.strategies = strategies;
    this.name = name;
  }

  async route(
    context: RoutingContext,
    config: Config,
    baseLlmClient: BaseLlmClient,
  ): Promise<RoutingDecision> {
    const startTime = performance.now();

    // Separate non-terminal strategies from the terminal one.
    // This separation allows TypeScript to understand the control flow guarantees.
    const nonTerminalStrategies = this.strategies.slice(
      0,
      -1,
    ) as RoutingStrategy[];
    const terminalStrategy = this.strategies[
      this.strategies.length - 1
    ] as TerminalStrategy;

    // Try non-terminal strategies, allowing them to fail gracefully.
    for (const strategy of nonTerminalStrategies) {
      try {
        const decision = await strategy.route(context, config, baseLlmClient);
        if (decision) {
          return this.finalizeDecision(decision, startTime);
        }
      } catch (error) {
        console.error(
          `[Routing] Strategy '${strategy.name}' failed. Continuing to next strategy. Error:`,
          error,
        );
      }
    }

    // If no other strategy matched, execute the terminal strategy.
    try {
      const decision = await terminalStrategy.route(
        context,
        config,
        baseLlmClient,
      );

      return this.finalizeDecision(decision, startTime);
    } catch (error) {
      console.error(
        `[Routing] Critical Error: Terminal strategy '${terminalStrategy.name}' failed. Routing cannot proceed. Error:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Helper function to enhance the decision metadata with composite information.
   */
  private finalizeDecision(
    decision: RoutingDecision,
    startTime: number,
  ): RoutingDecision {
    const endTime = performance.now();
    const compositeSource = `${this.name}/${decision.metadata.source}`;

    // Use the child's latency if it's a meaningful (non-zero) value,
    // otherwise use the total time spent in the composite strategy.
    const latency = decision.metadata.latencyMs || endTime - startTime;

    return {
      ...decision,
      metadata: {
        ...decision.metadata,
        source: compositeSource,
        latencyMs: Math.round(latency), // Round to ensure int for telemetry.
      },
    };
  }
}
