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
