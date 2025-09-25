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
import { AuthType } from '@salesforce/codey-core';

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
): Response {
  if (context) {
    withContext(context).error({ error: message, ...context }, 'API Error');
  }
  return c.json({ error: message }, status);
}

export function validateAuthType(body: Record<string, unknown>): {
  authType: AuthType | null;
  error: string | null;
} {
  const authType = body['authType'];

  if (!authType || typeof authType !== 'string') {
    return { authType: null, error: 'authType is required' };
  }

  const trimmed = authType.trim();
  if (trimmed === 'gemini') {
    // Check if GEMINI_API_KEY is set
    if (!process.env['GEMINI_API_KEY']) {
      return {
        authType: null,
        error:
          'GEMINI_API_KEY environment variable is required when authType is "gemini"',
      };
    }
    return { authType: AuthType.USE_GEMINI, error: null };
  } else if (trimmed === 'gateway') {
    // Check if org is available either in CODEY_GATEWAY_ORG env var or org param
    const envOrg = process.env['CODEY_GATEWAY_ORG'];
    const requestOrg = body['org'];
    const hasValidOrg =
      envOrg ||
      (requestOrg && typeof requestOrg === 'string' && requestOrg.trim());

    if (!hasValidOrg) {
      return {
        authType: null,
        error:
          'org is required when authType is "gateway" (provide via CODEY_GATEWAY_ORG environment variable or org parameter)',
      };
    }
    return { authType: AuthType.USE_SF_LLMG, error: null };
  } else {
    return {
      authType: null,
      error: 'authType must be either "gemini" or "gateway"',
    };
  }
}

export function validateOrg(
  body: Record<string, unknown>,
  authType: AuthType,
): { org: string | null; error: string | null } {
  const requestOrg = body['org'];
  const envOrg = process.env['CODEY_GATEWAY_ORG'];

  // If authType is gateway, determine which org to use
  if (authType === AuthType.USE_SF_LLMG) {
    // Prefer request org over environment org if both are provided
    if (requestOrg && typeof requestOrg === 'string' && requestOrg.trim()) {
      return { org: requestOrg.trim(), error: null };
    }

    // Fall back to environment org if request org is not provided
    if (envOrg && envOrg.trim()) {
      return { org: envOrg.trim(), error: null };
    }

    // This should not happen since validateAuthType already checked for this
    return { org: null, error: 'org is required when authType is "gateway"' };
  }

  // For other auth types, org is optional but if provided should be a string
  if (
    requestOrg !== undefined &&
    (typeof requestOrg !== 'string' || !requestOrg.trim())
  ) {
    return { org: null, error: null }; // Ignore invalid org for non-gateway auth types
  }

  return {
    org: typeof requestOrg === 'string' ? requestOrg.trim() : null,
    error: null,
  };
}

export function createSuccessResponse(
  c: Context,
  data: Record<string, unknown>,
  status: ContentfulStatusCode = 200,
  headers?: Record<string, string>,
): Response {
  const response = c.json(data, status);
  if (headers) {
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }
  return response;
}
