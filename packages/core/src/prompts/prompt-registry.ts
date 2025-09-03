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

import type { DiscoveredMCPPrompt } from '../tools/mcp-client.js';

export class PromptRegistry {
  private prompts: Map<string, DiscoveredMCPPrompt> = new Map();

  /**
   * Registers a prompt definition.
   * @param prompt - The prompt object containing schema and execution logic.
   */
  registerPrompt(prompt: DiscoveredMCPPrompt): void {
    if (this.prompts.has(prompt.name)) {
      const newName = `${prompt.serverName}_${prompt.name}`;
      console.warn(
        `Prompt with name "${prompt.name}" is already registered. Renaming to "${newName}".`,
      );
      this.prompts.set(newName, { ...prompt, name: newName });
    } else {
      this.prompts.set(prompt.name, prompt);
    }
  }

  /**
   * Returns an array of all registered and discovered prompt instances.
   */
  getAllPrompts(): DiscoveredMCPPrompt[] {
    return Array.from(this.prompts.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  /**
   * Get the definition of a specific prompt.
   */
  getPrompt(name: string): DiscoveredMCPPrompt | undefined {
    return this.prompts.get(name);
  }

  /**
   * Returns an array of prompts registered from a specific MCP server.
   */
  getPromptsByServer(serverName: string): DiscoveredMCPPrompt[] {
    const serverPrompts: DiscoveredMCPPrompt[] = [];
    for (const prompt of this.prompts.values()) {
      if (prompt.serverName === serverName) {
        serverPrompts.push(prompt);
      }
    }
    return serverPrompts.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Clears all the prompts from the registry.
   */
  clear(): void {
    this.prompts.clear();
  }

  /**
   * Removes all prompts from a specific server.
   */
  removePromptsByServer(serverName: string): void {
    for (const [name, prompt] of this.prompts.entries()) {
      if (prompt.serverName === serverName) {
        this.prompts.delete(name);
      }
    }
  }
}
