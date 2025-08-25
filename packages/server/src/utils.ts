/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { IncomingMessage, ServerResponse } from 'http';
import { logger } from './logger.js';

// Utility function to parse JSON from request body
export async function parseRequestBody(
  req: IncomingMessage,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        resolve(parsed);
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });

    req.on('error', (error) => {
      reject(error);
    });
  });
}

// Utility function to send JSON response
export function sendJsonResponse(
  res: ServerResponse,
  statusCode: number,
  data: Record<string, unknown>,
): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Format error for consistent error handling
export function formatError(error: unknown): {
  message: string;
  stack?: string;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
    };
  }
  return {
    message: 'Unknown error',
  };
}

// Centralized error handling
export function handleError(
  res: ServerResponse,
  requestId: string,
  startTime: number,
  error: unknown,
  statusCode: number = 500,
  context: Record<string, unknown> = {},
): void {
  const duration = Date.now() - startTime;
  const formattedError = formatError(error);

  logger.error('Request error', {
    requestId,
    duration,
    error: formattedError.message,
    stack: formattedError.stack,
    ...context,
  });

  const responseMessage =
    statusCode === 500 ? 'Internal server error' : formattedError.message;

  sendJsonResponse(res, statusCode, { error: responseMessage });
  logger.logResponse(requestId, statusCode, duration, context);
}

// Validate required field
export function validateRequired(
  value: unknown,
  fieldName: string,
): string | null {
  if (!value || typeof value !== 'string' || !value.trim()) {
    return `${fieldName} is required`;
  }
  return null;
}

// Validate workspaceRoot specifically
export function validateWorkspaceRoot(
  body: Record<string, unknown>,
): string | null {
  const workspaceRoot = body.workspaceRoot;
  const error = validateRequired(workspaceRoot, 'workspaceRoot');
  return error ? null : (workspaceRoot as string);
}

// Validate message specifically
export function validateMessage(body: Record<string, unknown>): string | null {
  const message = body.message;
  if (!message || typeof message !== 'string') {
    return null;
  }
  const trimmed = message.trim();
  return trimmed || null;
}

// Send success response with automatic logging
export function sendSuccess(
  res: ServerResponse,
  requestId: string,
  startTime: number,
  statusCode: number,
  data: Record<string, unknown>,
  logContext: Record<string, unknown> = {},
): void {
  const duration = Date.now() - startTime;
  sendJsonResponse(res, statusCode, data);
  logger.logResponse(requestId, statusCode, duration, logContext);
}

// Send error response with automatic logging
export function sendError(
  res: ServerResponse,
  requestId: string,
  startTime: number,
  statusCode: number,
  message: string,
  logContext: Record<string, unknown> = {},
): void {
  const duration = Date.now() - startTime;

  logger.error('Request validation error', {
    requestId,
    error: message,
    ...logContext,
  });

  sendJsonResponse(res, statusCode, { error: message });
  logger.logResponse(requestId, statusCode, duration, logContext);
}
