import { Hono } from 'hono';

export const health = new Hono();

health.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'codey-server',
  });
});
