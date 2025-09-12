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

import { type FunctionCall } from '@google/genai';
import {
  PolicyDecision,
  type PolicyEngineConfig,
  type PolicyRule,
} from './types.js';
import { stableStringify } from './stable-stringify.js';

function ruleMatches(
  rule: PolicyRule,
  toolCall: FunctionCall,
  stringifiedArgs: string | undefined,
): boolean {
  // Check tool name if specified
  if (rule.toolName && toolCall.name !== rule.toolName) {
    return false;
  }

  // Check args pattern if specified
  if (rule.argsPattern) {
    // If rule has an args pattern but tool has no args, no match
    if (!toolCall.args) {
      return false;
    }
    // Use stable JSON stringification with sorted keys to ensure consistent matching
    if (
      stringifiedArgs === undefined ||
      !rule.argsPattern.test(stringifiedArgs)
    ) {
      return false;
    }
  }

  return true;
}

export class PolicyEngine {
  private rules: PolicyRule[];
  private readonly defaultDecision: PolicyDecision;
  private readonly nonInteractive: boolean;

  constructor(config: PolicyEngineConfig = {}) {
    this.rules = (config.rules ?? []).sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
    );
    this.defaultDecision = config.defaultDecision ?? PolicyDecision.ASK_USER;
    this.nonInteractive = config.nonInteractive ?? false;
  }

  /**
   * Check if a tool call is allowed based on the configured policies.
   */
  check(toolCall: FunctionCall): PolicyDecision {
    let stringifiedArgs: string | undefined;
    // Compute stringified args once before the loop
    if (toolCall.args && this.rules.some((rule) => rule.argsPattern)) {
      stringifiedArgs = stableStringify(toolCall.args);
    }

    // Find the first matching rule (already sorted by priority)
    for (const rule of this.rules) {
      if (ruleMatches(rule, toolCall, stringifiedArgs)) {
        return this.applyNonInteractiveMode(rule.decision);
      }
    }

    // No matching rule found, use default decision
    return this.applyNonInteractiveMode(this.defaultDecision);
  }

  /**
   * Add a new rule to the policy engine.
   */
  addRule(rule: PolicyRule): void {
    this.rules.push(rule);
    // Re-sort rules by priority
    this.rules.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  /**
   * Remove rules for a specific tool.
   */
  removeRulesForTool(toolName: string): void {
    this.rules = this.rules.filter((rule) => rule.toolName !== toolName);
  }

  /**
   * Get all current rules.
   */
  getRules(): readonly PolicyRule[] {
    return this.rules;
  }

  private applyNonInteractiveMode(decision: PolicyDecision): PolicyDecision {
    // In non-interactive mode, ASK_USER becomes DENY
    if (this.nonInteractive && decision === PolicyDecision.ASK_USER) {
      return PolicyDecision.DENY;
    }
    return decision;
  }
}
