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

import type {
  MCPServerStatus,
  ToolConfirmationOutcome,
} from '@google/gemini-cli-core';
import type { TaskState } from '@a2a-js/sdk';

// Interfaces and enums for the CoderAgent protocol.

export enum CoderAgentEvent {
  /**
   * An event requesting one or more tool call confirmations.
   */
  ToolCallConfirmationEvent = 'tool-call-confirmation',
  /**
   * An event updating on the status of one or more tool calls.
   */
  ToolCallUpdateEvent = 'tool-call-update',
  /**
   * An event providing text updates on the task.
   */
  TextContentEvent = 'text-content',
  /**
   * An event that indicates a change in the task's execution state.
   */
  StateChangeEvent = 'state-change',
  /**
   * An user-sent event to initiate the agent.
   */
  StateAgentSettingsEvent = 'agent-settings',
  /**
   * An event that contains a thought from the agent.
   */
  ThoughtEvent = 'thought',
}

export interface AgentSettings {
  kind: CoderAgentEvent.StateAgentSettingsEvent;
  workspacePath: string;
}

export interface ToolCallConfirmation {
  kind: CoderAgentEvent.ToolCallConfirmationEvent;
}

export interface ToolCallUpdate {
  kind: CoderAgentEvent.ToolCallUpdateEvent;
}

export interface TextContent {
  kind: CoderAgentEvent.TextContentEvent;
}

export interface StateChange {
  kind: CoderAgentEvent.StateChangeEvent;
}

export interface Thought {
  kind: CoderAgentEvent.ThoughtEvent;
}

export type ThoughtSummary = {
  subject: string;
  description: string;
};

export interface ToolConfirmationResponse {
  outcome: ToolConfirmationOutcome;
  callId: string;
}

export type CoderAgentMessage =
  | AgentSettings
  | ToolCallConfirmation
  | ToolCallUpdate
  | TextContent
  | StateChange
  | Thought;

export interface TaskMetadata {
  id: string;
  contextId: string;
  taskState: TaskState;
  model: string;
  mcpServers: Array<{
    name: string;
    status: MCPServerStatus;
    tools: Array<{
      name: string;
      description: string;
      parameterSchema: unknown;
    }>;
  }>;
  availableTools: Array<{
    name: string;
    description: string;
    parameterSchema: unknown;
  }>;
}

export interface PersistedStateMetadata {
  _agentSettings: AgentSettings;
  _taskState: TaskState;
}

export type PersistedTaskMetadata = { [k: string]: unknown };

export const METADATA_KEY = '__persistedState';

export function getPersistedState(
  metadata: PersistedTaskMetadata,
): PersistedStateMetadata | undefined {
  return metadata?.[METADATA_KEY] as PersistedStateMetadata | undefined;
}

export function setPersistedState(
  metadata: PersistedTaskMetadata,
  state: PersistedStateMetadata,
): PersistedTaskMetadata {
  return {
    ...metadata,
    [METADATA_KEY]: state,
  };
}
