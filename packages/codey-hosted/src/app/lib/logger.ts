/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import pino from 'pino';

// Create Pino logger with development-friendly configuration
export const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  // Production format (JSON)
  ...(process.env.NODE_ENV === 'production' && {
    formatters: {
      level: (label) => {
        return { level: label };
      },
    },
  }),
});

// Type for log context (keeping compatibility with existing code)
export interface LogContext {
  requestId?: string;
  sessionId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  error?: string;
  [key: string]: unknown;
}
