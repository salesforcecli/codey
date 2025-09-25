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

import { Hono } from 'hono';
import type { Context } from 'hono';
import {
  createSession,
  hasSession,
  sendMessageToSession,
} from '../lib/session.js';
import {
  createErrorResponse,
  createSuccessResponse,
  validateMessage,
  validateWorkspaceRoot,
  validateAuthType,
  validateOrg,
} from '../lib/utils.js';
import { withContext } from '../lib/logger.js';

export const sessions = new Hono();

// POST /api/sessions - create session
sessions.post('/sessions', async (c: Context) => {
  const requestId =
    c.req.header('x-request-id') ||
    `req_${Math.random().toString(36).slice(2, 11)}`;
  const start = Date.now();
  const log = withContext({ requestId });

  try {
    const body = await c.req.json().catch(() => ({}));
    const workspaceRoot = validateWorkspaceRoot(body);
    if (!workspaceRoot) {
      return createErrorResponse(c, 'workspaceRoot is required', 400, {
        requestId,
      });
    }

    const { authType, error } = validateAuthType(body);
    if (error) {
      return createErrorResponse(c, error, 400, {
        requestId,
      });
    }

    if (!authType) {
      return createErrorResponse(c, 'authType is required', 400, {
        requestId,
      });
    }

    const { org, error: orgError } = validateOrg(body, authType);
    if (orgError) {
      return createErrorResponse(c, orgError, 400, {
        requestId,
      });
    }

    const model = typeof body.model === 'string' ? body.model : undefined;

    log.info(
      { requestId, workspaceRoot, authType, org, model },
      'Creating session',
    );
    const { id } = await createSession(
      workspaceRoot,
      authType,
      model,
      org || undefined,
    );
    const duration = Date.now() - start;
    log.info(
      { requestId, workspaceRoot, authType, org, model, duration, id },
      'Session created',
    );

    return createSuccessResponse(c, { sessionId: id }, 201, {
      Location: `/api/sessions/${id}`,
    });
  } catch (err) {
    const duration = Date.now() - start;
    withContext({ requestId }).error(
      { requestId, duration, err },
      'Error creating session',
    );
    return createErrorResponse(c, 'Internal server error', 500, { requestId });
  }
});

// POST /api/sessions/:id/messages - non-streaming
sessions.post('/sessions/:id/messages', async (c: Context) => {
  const requestId =
    c.req.header('x-request-id') ||
    `req_${Math.random().toString(36).slice(2, 11)}`;
  const start = Date.now();
  const sessionId = c.req.param('id');
  const log = withContext({ requestId, sessionId });

  try {
    if (!hasSession(sessionId)) {
      return createErrorResponse(c, 'Session not found', 404, {
        requestId,
        sessionId,
      });
    }

    const body = await c.req.json().catch(() => ({}));
    const message = validateMessage(body);
    if (!message) {
      return createErrorResponse(c, 'Message is required', 400, {
        requestId,
        sessionId,
      });
    }

    log.info(
      {
        requestId,
        sessionId,
        messageLength: message.length,
        message,
      },
      'Processing session message',
    );

    const { response, turnCount, events } = await sendMessageToSession(
      sessionId,
      message,
    );
    const duration = Date.now() - start;

    log.info(
      {
        requestId,
        sessionId,
        responseLength: response.length,
        response,
        turnCount,
        duration,
        events,
      },
      'Session message completed',
    );

    return createSuccessResponse(c, {
      sessionId,
      response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const duration = Date.now() - start;
    log.error(
      { requestId, sessionId, duration, err: error },
      'Error handling session message',
    );
    return createErrorResponse(c, 'Internal server error', 500, {
      requestId,
      sessionId,
    });
  }
});
