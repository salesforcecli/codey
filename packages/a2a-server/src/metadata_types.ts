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

import type { AgentSettings } from './types.js';
import type { TaskState } from '@a2a-js/sdk';

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
