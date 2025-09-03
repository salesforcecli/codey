import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import type { Context } from 'hono';
import { logger as baseLogger, withContext } from './lib/logger.js';
import { health } from './routes/health.js';
import { sessions } from './routes/sessions.js';
import { sessionsStream } from './routes/sessions.stream.js';

const app = new Hono();

// Request logging middleware
app.use('*', async (c: Context, next: () => Promise<void>) => {
  const started = Date.now();
  const method = c.req.method;
  const path = new URL(c.req.url).pathname;
  const requestId =
    c.req.header('x-request-id') ||
    `req_${Math.random().toString(36).slice(2, 11)}`;
  const log = withContext({ requestId, method, path });
  c.set('logger', log);

  log.info({ requestId, method, path }, 'Incoming request');

  try {
    await next();
  } catch (err) {
    const duration = Date.now() - started;
    log.error({ requestId, method, path, duration, err }, 'Unhandled error');
    return c.json({ error: 'Internal server error' }, 500);
  }

  const duration = Date.now() - started;
  const statusCode = c.res.status;
  log.info(
    { requestId, method, path, statusCode, duration },
    'Request completed',
  );
});

// Error boundary
app.onError((err: unknown, c: Context) => {
  const requestId =
    c.req.header('x-request-id') ||
    `req_${Math.random().toString(36).slice(2, 11)}`;
  withContext({ requestId }).error(
    { requestId, err },
    'Error boundary caught error',
  );
  return c.json({ error: 'Internal server error' }, 500);
});

// Mount routes under /api
const api = new Hono();
api.route('/', health);
api.route('/', sessions);
api.route('/', sessionsStream);
app.route('/api', api);

// 404 handler
app.notFound((c: Context) => c.json({ error: 'Not Found' }, 404));

const port = Number(process.env['PORT'] || 3000);
const server = serve({ fetch: app.fetch, port }, (_addr) => {
  baseLogger.info(`codey-server listening on http://localhost:${port}`);
});

// Graceful shutdown
function shutdown(signal: NodeJS.Signals) {
  baseLogger.info({ signal }, 'Shutting down');
  try {
    server?.close?.();
  } catch {}
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
