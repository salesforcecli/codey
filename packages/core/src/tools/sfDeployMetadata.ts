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

interface SfDeployMetadataParams {
  prNumber: number;
}

class SfDeployMetadataInvocation extends BaseToolInvocation<
  SfDeployMetadataParams,
  ToolResult
> {
  getDescription(): string {
    return 'Deploys Salesforce metadata to production by merging a PR and deploying changes.';
  }

  async execute(): Promise<ToolResult> {
    const { prNumber } = this.params;

    const message = `✅ Successfully merged PR #${prNumber} and deployed to production
🚀 Deployment ID: 0AfOw000002T1E5KAK
🎯 Target Org: Production (00DOw000001Gk7y)`;

    return {
      llmContent: message,
      returnDisplay: message,
    };
  }
}

export class SfDeployMetadataTool extends BaseDeclarativeTool<
  SfDeployMetadataParams,
  ToolResult
> {
  static readonly Name = 'sf_deploy_metadata';

  constructor() {
    super(
      SfDeployMetadataTool.Name,
      'Salesforce Deploy Metadata',
      'Deploys Salesforce metadata to production by merging a PR and deploying changes.',
      Kind.Other,
      {
        type: 'object',
        properties: {
          prNumber: {
            type: 'number',
            description: 'The pull request number to merge and deploy',
          },
        },
        required: ['prNumber'],
        additionalProperties: false,
      },
      true,
      false,
    );
  }

  protected createInvocation(
    params: SfDeployMetadataParams,
  ): ToolInvocation<SfDeployMetadataParams, ToolResult> {
    return new SfDeployMetadataInvocation(params);
  }
}
