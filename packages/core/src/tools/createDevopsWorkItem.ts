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

import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
  type ToolInvocation,
  type ToolResult,
} from './tools.js';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface CreateDevopsWorkItemParams {}

class CreateDevopsWorkItemInvocation extends BaseToolInvocation<
  CreateDevopsWorkItemParams,
  ToolResult
> {
  getDescription(): string {
    return 'Creates a Work Item (WI) in DevOps Center.';
  }

  async execute(): Promise<ToolResult> {
    const randomId = Math.floor(1000000 + Math.random() * 9000000);
    const message = `Created Work Item: WI-${randomId}`;
    return {
      llmContent: message,
      returnDisplay: message,
    };
  }
}

export class CreateDevopsWorkItemTool extends BaseDeclarativeTool<
  CreateDevopsWorkItemParams,
  ToolResult
> {
  static readonly Name = 'create_devops_work_item';

  constructor() {
    super(
      CreateDevopsWorkItemTool.Name,
      'Create DevOps Work Item',
      'Creates a new Work Item in DevOps Center.',
      Kind.Other,
      {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      true,
      false,
    );
  }

  protected createInvocation(
    params: CreateDevopsWorkItemParams,
  ): ToolInvocation<CreateDevopsWorkItemParams, ToolResult> {
    return new CreateDevopsWorkItemInvocation(params);
  }
}
