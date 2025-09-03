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
    const model = typeof body.model === 'string' ? body.model : undefined;

    log.info({ requestId, workspaceRoot, model }, 'Creating session');
    const { id } = await createSession(workspaceRoot, model);
    const duration = Date.now() - start;
    log.info(
      { requestId, workspaceRoot, model, duration, id },
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
    const workspaceRoot = validateWorkspaceRoot(body);
    if (!workspaceRoot) {
      return createErrorResponse(c, 'workspaceRoot is required', 400, {
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
        workspaceRoot,
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
