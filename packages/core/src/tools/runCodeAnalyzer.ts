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
interface RunCodeAnalyzerParams {}

class RunCodeAnalyzerInvocation extends BaseToolInvocation<
  RunCodeAnalyzerParams,
  ToolResult
> {
  getDescription(): string {
    return 'Analyze an Apex class with Code Analyzer for performance issues.';
  }

  async execute(): Promise<ToolResult> {
    const message = `Code Analyzer Report: Below are the key findings and recommendations for the Apex class. Summarize the findings and recommendations in a helpful manner to the user.

<findings>
1.  Inefficient Total Item Count: The Database.countQuery('SELECT count() FROM Product__c ' + whereClause) can be very slow on objects with many records. It has to scan a large portion of the database table just to get the total count, which is a common cause of timeouts in pagination logic.
2.  Slow Pagination with OFFSET: The query ORDER BY Name OFFSET :offset becomes progressively slower as the pageNumber (and thus the offset) increases. The database must scan and discard all the rows from the beginning up to the offset value for every page request.
3.  Non-Indexed Search Query: The search functionality uses LIKE :key where key is '%searchKey%'. Using a leading wildcard (%) prevents the database from using an index on the Name field, forcing a full table scan which is very inefficient.
4.  Potentially Unindexed Filter Fields: The fields used in the WHERE clause (MSRP__c, Category__c, Level__c, Material__c) may not be indexed. Queries filtering on unindexed fields will be slower.
</findings>

<recommendations>
•   For immediate improvement: Avoid the leading wildcard in the search term if possible. If you must perform a wildcard search, consider using SOSL as it is optimized for text searches.
•   For better scalability: Instead of using OFFSET, consider implementing keyset pagination. This involves using the last value of the sorted field from the previous page to query for the next set of records, which is much more efficient.
•   For overall performance: Ensure that the frequently filtered fields (Category__c, Level__c, Material__c) are indexed in Salesforce.
</recommendations>
`;
    return {
      llmContent: message,
      returnDisplay: message,
    };
  }
}

export class RunCodeAnalyzerTool extends BaseDeclarativeTool<
  RunCodeAnalyzerParams,
  ToolResult
> {
  static readonly Name = 'sf_run_code_analyzer';

  constructor() {
    super(
      RunCodeAnalyzerTool.Name,
      'Run Code Analyzer',
      'Use Code Analyzer to analyze an Apex class for performance issues.',
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
    params: RunCodeAnalyzerParams,
  ): ToolInvocation<RunCodeAnalyzerParams, ToolResult> {
    return new RunCodeAnalyzerInvocation(params);
  }
}
