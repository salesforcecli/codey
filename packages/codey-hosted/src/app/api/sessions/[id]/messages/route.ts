/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NextRequest } from 'next/server';
import {
  hasSession,
  sendMessageToSession,
  sendMessageToSessionStreaming,
} from '../../../../lib/session';
import {
  validateWorkspaceRoot,
  validateMessage,
  createErrorResponse,
  createSuccessResponse,
} from '../../../../lib/utils';
import { logger } from '../../../../lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = `req_${Math.random().toString(36).slice(2, 11)}`;
  const startTime = Date.now();
  const { id: sessionId } = await params;

  try {
    if (!hasSession(sessionId)) {
      return createErrorResponse('Session not found', 404, {
        requestId,
        sessionId,
      });
    }

    const body = await request.json();
    const message = validateMessage(body);
    if (!message) {
      return createErrorResponse('Message is required', 400, {
        requestId,
        sessionId,
      });
    }

    const workspaceRoot = validateWorkspaceRoot(body);
    if (!workspaceRoot) {
      return createErrorResponse('workspaceRoot is required', 400, {
        requestId,
        sessionId,
      });
    }

    logger.info(
      {
        requestId,
        sessionId,
        messageLength: message.length,
        message,
        workspaceRoot,
      },
      'Processing session message',
    );

    const shouldStream =
      request.headers.get('accept')?.includes('application/x-ndjson') ||
      request.nextUrl.searchParams.get('stream') === '1';

    if (shouldStream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          function write(obj: unknown) {
            controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
          }

          sendMessageToSessionStreaming(sessionId, message, (event) => {
            write(event);
          })
            .catch((err) => {
              write({ type: 'error', message: err?.message || String(err) });
            })
            .finally(() => {
              controller.close();
            });
        },
      });

      logger.info(
        {
          requestId,
          sessionId,
          messageLength: message.length,
          duration: Date.now() - startTime,
          streamed: true,
        },
        'Session message streaming started',
      );

      return new Response(stream, {
        headers: {
          'Content-Type': 'application/x-ndjson',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'Transfer-Encoding': 'chunked',
        },
      });
    }

    const { response, turnCount, events } = await sendMessageToSession(
      sessionId,
      message,
    );

    logger.info(
      {
        requestId,
        sessionId,
        responseLength: response.length,
        response,
        turnCount,
        duration: Date.now() - startTime,
        events,
      },
      'Session message completed',
    );

    return createSuccessResponse({
      sessionId,
      response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(
      {
        requestId,
        sessionId,
        duration,
        err: error, // Pino automatically formats Error objects
      },
      'Error handling session message',
    );

    return createErrorResponse('Internal server error', 500, {
      requestId,
      sessionId,
    });
  }
}
