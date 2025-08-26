/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

interface LogContext {
  requestId?: string;
  sessionId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  error?: string;
  [key: string]: unknown;
}

class SimpleLogger {
  private generateRequestId(): string {
    return `req_${Math.random().toString(36).slice(2, 11)}`;
  }

  private log(level: string, message: string, context: LogContext = {}): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    };

    console.log(JSON.stringify(logEntry));
  }

  info(message: string, context: LogContext = {}): void {
    this.log('INFO', message, context);
  }

  error(message: string, context: LogContext = {}): void {
    this.log('ERROR', message, context);
  }

  warn(message: string, context: LogContext = {}): void {
    this.log('WARN', message, context);
  }

  debug(message: string, context: LogContext = {}): void {
    this.log('DEBUG', message, context);
  }

  // Helper method for request logging
  logRequest(method: string, path: string, context: LogContext = {}): string {
    const requestId = this.generateRequestId();
    this.info('Request received', {
      requestId,
      method,
      path,
      ...context,
    });
    return requestId;
  }

  // Helper method for response logging
  logResponse(
    requestId: string,
    statusCode: number,
    duration: number,
    context: LogContext = {},
  ): void {
    this.info('Request completed', {
      requestId,
      statusCode,
      duration,
      ...context,
    });
  }

  // Helper method for session logging
  logSession(
    action: string,
    sessionId: string,
    context: LogContext = {},
  ): void {
    this.info(`Session ${action}`, {
      sessionId,
      ...context,
    });
  }
}

export const logger = new SimpleLogger();
export type { LogContext };
