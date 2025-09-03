import { Hono } from 'hono';
import type { Context } from 'hono';
import { streamText } from 'hono/streaming';
import { hasSession, sendMessageToSessionStreaming } from '../lib/session.js';
import {
  createErrorResponse,
  validateMessage,
  validateWorkspaceRoot,
} from '../lib/utils.js';
import { withContext } from '../lib/logger.js';
import {
  GeminiEventType,
  type ServerGeminiStreamEvent,
} from '@google/gemini-cli-core';

export const sessionsStream = new Hono();

// POST /api/sessions/:id/messages/stream - streaming NDJSON
sessionsStream.post('/sessions/:id/messages/stream', async (c: Context) => {
  const requestId =
    c.req.header('x-request-id') ||
    `req_${Math.random().toString(36).slice(2, 11)}`;
  const start = Date.now();
  const sessionId = c.req.param('id');
  const log = withContext({ requestId, sessionId });

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
    { requestId, sessionId, messageLength: message.length },
    'Session message streaming started',
  );

  return streamText(
    c,
    async (stream: {
      write: (s: string) => Promise<void>;
      close: () => Promise<void>;
    }) => {
      const write = async (obj: unknown) => {
        await stream.write(JSON.stringify(obj) + '\n');
      };

      try {
        await sendMessageToSessionStreaming(
          sessionId,
          message,
          async (geminiEvent: ServerGeminiStreamEvent) => {
            try {
              log.debug(
                {
                  requestId,
                  sessionId,
                  eventType: geminiEvent.type,
                  event: geminiEvent,
                  ...(geminiEvent.type === GeminiEventType.Thought
                    ? { thoughtContent: geminiEvent.value }
                    : {}),
                  ...(geminiEvent.type === GeminiEventType.ToolCallRequest
                    ? {
                        toolName: geminiEvent.value.name,
                        toolArgs: geminiEvent.value.args,
                      }
                    : {}),
                  ...(geminiEvent.type === GeminiEventType.ToolCallResponse
                    ? {
                        toolCallId: geminiEvent.value.callId,
                        toolSuccess: !geminiEvent.value.error,
                        toolError: geminiEvent.value.error?.message,
                      }
                    : {}),
                  ...(geminiEvent.type === GeminiEventType.Content
                    ? { contentDelta: (geminiEvent as any).value }
                    : {}),
                },
                'ServerGeminiStreamEvent received',
              );
            } catch (logError) {
              log.warn(
                { requestId, sessionId, logError },
                'Failed to log event',
              );
            }
            await write(geminiEvent);
          },
        );
      } catch (err) {
        log.error({ requestId, sessionId, err }, 'Error during streaming');
        const errorEvent: ServerGeminiStreamEvent = {
          type: GeminiEventType.Error,
          value: {
            error: {
              message: (err as Error)?.message || String(err),
              status: 500,
            },
          },
        } as ServerGeminiStreamEvent;
        await write(errorEvent);
      } finally {
        log.info(
          { requestId, sessionId, duration: Date.now() - start },
          'Session message streaming finished',
        );
        try {
          await stream.close();
        } catch {
          // ignore
        }
      }
    },
    {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Transfer-Encoding': 'chunked',
      },
    },
  );
});
