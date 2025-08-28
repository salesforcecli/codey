/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
  ToolInvocation,
  ToolResult,
} from './tools.js';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface CreateDevopsWorkItemParams {}

class CreateDevopsWorkItemInvocation extends BaseToolInvocation<
  CreateDevopsWorkItemParams,
  ToolResult
> {
  getDescription(): string {
    return 'Creates a Work Item in DevOps Center.';
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
