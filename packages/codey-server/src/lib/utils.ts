import type { Context } from 'hono';
import { withContext, type LogContext } from './logger.js';

export function validateRequired(value: unknown, name: string): string | null {
  if (!value || typeof value !== 'string' || !value.trim()) {
    return `${name} is required`;
  }
  return null;
}

export function validateWorkspaceRoot(
  body: Record<string, unknown>,
): string | null {
  const workspaceRoot = body['workspaceRoot'];
  const error = validateRequired(workspaceRoot, 'workspaceRoot');
  return error ? null : (workspaceRoot as string);
}

export function validateMessage(body: Record<string, unknown>): string | null {
  const message = body['message'];
  if (!message || typeof message !== 'string') {
    return null;
  }
  const trimmed = message.trim();
  return trimmed || null;
}

export function createErrorResponse(
  c: Context,
  message: string,
  status: number = 500,
  context?: LogContext,
) {
  if (context) {
    withContext(context).error({ error: message, ...context }, 'API Error');
  }
  return c.json({ error: message }, status);
}

export function createSuccessResponse(
  c: Context,
  data: Record<string, unknown>,
  status: number = 200,
  headers?: Record<string, string>,
) {
  const response = c.json(data, status);
  if (headers) {
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }
  return response;
}
