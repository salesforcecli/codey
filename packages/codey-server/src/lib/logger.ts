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
