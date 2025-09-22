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

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Storage } from '@salesforce/codey-core';

export function hasSeenTelemetryNotice(): boolean {
  try {
    const p = Storage.getTelemetryNoticeSeenPath();
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

export function markTelemetryNoticeSeen(): void {
  try {
    const p = Storage.getTelemetryNoticeSeenPath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, '1');
  } catch {
    // best-effort
  }
}
