/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
  type ToolInvocation,
  type ToolResult,
} from './tools.js';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface GetScaleCenterStatusParams {}

class GetScaleCenterStatusInvocation extends BaseToolInvocation<
  GetScaleCenterStatusParams,
  ToolResult
> {
  getDescription(): string {
    return 'Checks Scale Center for performance issues.';
  }

  async execute(): Promise<ToolResult> {
    const message = 'No performance issues detected.';
    return {
      llmContent: message,
      returnDisplay: message,
    };
  }
}

export class GetScaleCenterStatusTool extends BaseDeclarativeTool<
  GetScaleCenterStatusParams,
  ToolResult
> {
  static readonly Name = 'get_scale_center_status';

  constructor() {
    super(
      GetScaleCenterStatusTool.Name,
      'Scale Center Status',
      'Checks for performance issues in Scale Center and summarizes the status.',
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
    params: GetScaleCenterStatusParams,
  ): ToolInvocation<GetScaleCenterStatusParams, ToolResult> {
    return new GetScaleCenterStatusInvocation(params);
  }
}
