import { serve } from '@hono/node-server';

import { app } from './app.js';

const DEFAULT_PORT = 3000;
const parsedPort = Number(process.env['PORT']);
const port = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`BFF listening on http://localhost:${info.port}`);
});
