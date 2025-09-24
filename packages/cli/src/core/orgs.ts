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

import { ConfigAggregator, OrgConfigProperties } from '@salesforce/core';

export async function getDefaultOrgs(): Promise<{
  defaultTargetOrg: string | null;
  defaultTargetDevhub: string | null;
}> {
  const aggregator = await ConfigAggregator.create();
  return {
    defaultTargetOrg:
      aggregator.getPropertyValue(OrgConfigProperties.TARGET_ORG) ?? null,
    defaultTargetDevhub:
      aggregator.getPropertyValue(OrgConfigProperties.TARGET_DEV_HUB) ?? null,
  };
}
