import { Hono } from 'hono';

export const app = new Hono();

app.get('/health', (c) =>
  c.json({
    status: 'ok',
    service: 'bff',
    timestamp: new Date().toISOString(),
  }),
);
