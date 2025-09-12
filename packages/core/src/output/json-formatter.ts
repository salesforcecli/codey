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

import stripAnsi from 'strip-ansi';
import type { SessionMetrics } from '../telemetry/uiTelemetry.js';
import type { JsonError, JsonOutput } from './types.js';

export class JsonFormatter {
  format(response?: string, stats?: SessionMetrics, error?: JsonError): string {
    const output: JsonOutput = {};

    if (response !== undefined) {
      output.response = stripAnsi(response);
    }

    if (stats) {
      output.stats = stats;
    }

    if (error) {
      output.error = error;
    }

    return JSON.stringify(output, null, 2);
  }

  formatError(error: Error, code?: string | number): string {
    const jsonError: JsonError = {
      type: error.constructor.name,
      message: stripAnsi(error.message),
      ...(code && { code }),
    };

    return this.format(undefined, undefined, jsonError);
  }
}
