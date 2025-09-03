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

import pino, { stdTimeFunctions } from 'pino';
import type { Logger } from 'pino';

export type LogContext = {
  requestId?: string;
  sessionId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  error?: unknown;
  [key: string]: unknown;
};

const isProd = process.env['NODE_ENV'] === 'production';

function createBaseLogger(): Logger {
  if (isProd) {
    return pino({
      level: process.env['LOG_LEVEL'] ?? 'info',
      timestamp: stdTimeFunctions.isoTime,
      messageKey: 'message',
    });
  }
  return pino({
    level: process.env['LOG_LEVEL'] ?? 'debug',
    timestamp: stdTimeFunctions.isoTime,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: true,
        ignore: 'pid,hostname',
        singleLine: false,
      },
    },
  });
}

export const logger = createBaseLogger();

export function withContext(context: LogContext): Logger {
  return logger.child({ ...context });
}
