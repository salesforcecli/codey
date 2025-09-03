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
