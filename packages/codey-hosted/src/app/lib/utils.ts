/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NextResponse } from 'next/server';
import { logger } from './logger';

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

// Create error response
export function createErrorResponse(
  message: string,
  status: number = 500,
  context?: Record<string, unknown>,
) {
  if (context) {
    logger.error({ error: message, ...context }, 'API Error');
  }
  return NextResponse.json({ error: message }, { status });
}

// Create success response
export function createSuccessResponse(
  data: Record<string, unknown>,
  status: number = 200,
  headers?: Record<string, string>,
) {
  const response = NextResponse.json(data, { status });

  if (headers) {
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  return response;
}
