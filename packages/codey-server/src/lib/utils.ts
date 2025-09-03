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

import type { Context } from 'hono';
import { withContext, type LogContext } from './logger.js';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

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
  status: ContentfulStatusCode = 500,
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
  status: ContentfulStatusCode = 200,
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
