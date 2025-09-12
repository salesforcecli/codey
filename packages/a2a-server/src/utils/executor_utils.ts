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

import type { Message } from '@a2a-js/sdk';
import type { ExecutionEventBus } from '@a2a-js/sdk/server';
import { v4 as uuidv4 } from 'uuid';

import { CoderAgentEvent } from '../types.js';
import type { StateChange } from '../types.js';

export async function pushTaskStateFailed(
  error: unknown,
  eventBus: ExecutionEventBus,
  taskId: string,
  contextId: string,
) {
  const errorMessage =
    error instanceof Error ? error.message : 'Agent execution error';
  const stateChange: StateChange = {
    kind: CoderAgentEvent.StateChangeEvent,
  };
  eventBus.publish({
    kind: 'status-update',
    taskId,
    contextId,
    status: {
      state: 'failed',
      message: {
        kind: 'message',
        role: 'agent',
        parts: [
          {
            kind: 'text',
            text: errorMessage,
          },
        ],
        messageId: uuidv4(),
        taskId,
        contextId,
      } as Message,
    },
    final: true,
    metadata: {
      coderAgent: stateChange,
      model: 'unknown',
      error: errorMessage,
    },
  });
}
