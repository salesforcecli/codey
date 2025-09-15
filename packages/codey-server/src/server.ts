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
  let path: string;
  try {
    path = new URL(c.req.url, 'http://localhost').pathname;
  } catch {
    path = c.req.path || '/';
  }
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
    // Ensure error is propagated to the error boundary
    throw err;
  }

  const duration = Date.now() - started;
  // c.res may not always be set, fallback to 200 if undefined
  const statusCode = c.res?.status ?? 200;
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
  } catch {
    // Ignore errors if the server is already closed
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
