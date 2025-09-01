/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { createSession, hasSession, sendMessageToSession } from './session.js';
import { logger } from './logger.js';
import {
  parseRequestBody,
  handleError,
  validateWorkspaceRoot,
  validateMessage,
  sendSuccess,
  sendError,
} from './utils.js';

const PORT = process.env['PORT'] || 3000;

// Health check endpoint
function handleHealth(
  res: ServerResponse,
  requestId: string,
  startTime: number,
): void {
  sendSuccess(res, requestId, startTime, 200, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'gemini-cli-server',
  });
}

// POST /sessions -> create session
async function handleCreateSession(
  req: IncomingMessage,
  res: ServerResponse,
  requestId: string,
  startTime: number,
): Promise<void> {
  try {
    const body = await parseRequestBody(req);
    const workspaceRoot = validateWorkspaceRoot(body);
    const model = body['model'] as string | undefined;

    if (!workspaceRoot) {
      return sendError(
        res,
        requestId,
        startTime,
        400,
        'workspaceRoot is required',
        {
          workspaceRoot: body['workspaceRoot'],
          model,
        },
      );
    }

    const { id } = await createSession(workspaceRoot, model);

    logger.logSession('created', id, {
      requestId,
      workspaceRoot,
      model,
    });

    res.setHeader('Location', `/sessions/${id}`);
    sendSuccess(
      res,
      requestId,
      startTime,
      201,
      { sessionId: id },
      { sessionId: id },
    );
  } catch (error) {
    handleError(res, requestId, startTime, error, 500, {
      action: 'create_session',
    });
  }
}

// POST /sessions/{id}/messages -> send message in existing session
async function handleSessionMessage(
  req: IncomingMessage,
  res: ServerResponse,
  sessionId: string,
  requestId: string,
  startTime: number,
): Promise<void> {
  try {
    if (!hasSession(sessionId)) {
      return sendError(res, requestId, startTime, 404, 'Session not found', {
        sessionId,
      });
    }

    const body = await parseRequestBody(req);
    const message = validateMessage(body);
    if (!message) {
      return sendError(res, requestId, startTime, 400, 'Message is required', {
        sessionId,
      });
    }

    const workspaceRoot = validateWorkspaceRoot(body);
    if (!workspaceRoot) {
      return sendError(
        res,
        requestId,
        startTime,
        400,
        'workspaceRoot is required',
        { sessionId },
      );
    }

    logger.info('Processing session message', {
      requestId,
      sessionId,
      messageLength: message.length,
      workspaceRoot,
    });

    const { response, turnCount } = await sendMessageToSession(
      sessionId,
      message,
    );

    logger.info('Session message completed', {
      requestId,
      sessionId,
      responseLength: response.length,
      turnCount,
    });

    sendSuccess(
      res,
      requestId,
      startTime,
      200,
      {
        sessionId,
        response,
        timestamp: new Date().toISOString(),
      },
      {
        sessionId,
        responseLength: response.length,
        turnCount,
      },
    );
  } catch (error) {
    handleError(res, requestId, startTime, error, 500, {
      sessionId,
      action: 'session_message',
    });
  }
}

// 404 handler
function handleNotFound(
  res: ServerResponse,
  requestId: string,
  startTime: number,
): void {
  sendError(res, requestId, startTime, 404, 'Not found');
}

// Main request handler
async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const startTime = Date.now();
  const method = req.method || 'UNKNOWN';
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const path = url.pathname || '/';

  // Log incoming request
  const requestId = logger.logRequest(method, path);

  // Enable CORS for development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    const duration = Date.now() - startTime;
    logger.logResponse(requestId, 200, duration);
    return;
  }

  // Route handling
  try {
    if (req.method === 'GET' && path === '/health') {
      handleHealth(res, requestId, startTime);
      return;
    }

    if (req.method === 'POST' && path === '/sessions') {
      await handleCreateSession(req, res, requestId, startTime);
      return;
    }

    // Match /sessions/{id}/messages
    const msgMatch = path.match(/^\/sessions\/([^/]+)\/messages$/);
    if (req.method === 'POST' && msgMatch) {
      const sessionId = decodeURIComponent(msgMatch[1]);
      await handleSessionMessage(req, res, sessionId, requestId, startTime);
      return;
    }

    handleNotFound(res, requestId, startTime);
  } catch (error) {
    if (!res.headersSent) {
      handleError(res, requestId, startTime, error, 500, {
        method,
        path,
        action: 'request_handler',
      });
    }
  }
}

// Create and start server
const server = createServer(handleRequest);

server.listen(PORT, () => {
  logger.info('Server started', {
    port: PORT,
    nodeVersion: process.version,
    environment: process.env['NODE_ENV'] || 'development',
    endpoints: [
      'GET /health',
      'POST /sessions',
      'POST /sessions/{id}/messages',
    ],
  });

  // Keep the console output for development convenience
  console.log(`🚀 Gemini CLI Server running on http://localhost:${PORT}`);
  console.log('📋 Available endpoints:');
  console.log('   GET  /health                        - Health check');
  console.log('   POST /sessions                      - Create session');
  console.log(
    '   POST /sessions/{id}/messages        - Send message in session',
  );
  console.log('\n💡 Example usage:');
  console.log(`   curl http://localhost:${PORT}/health`);
  console.log(`   curl -X POST http://localhost:${PORT}/sessions \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(
    `     -d '{"workspaceRoot": "/path/to/workspace", "model": "gemini-2.5-flash-lite"}'`,
  );
  console.log(
    `   curl -X POST http://localhost:${PORT}/sessions/<id>/messages \\`,
  );
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(
    `     -d '{"message": "Hello!", "workspaceRoot": "/path/to/workspace"}'`,
  );
});

export { server };
