import { serve } from '@hono/node-server';

import { buildDefaultApp } from './app.js';
import { runMigrations } from './db/migrations.js';
import { getPool } from './db/pool.js';

const DEFAULT_PORT = 3000;
const parsedPort = Number(process.env['PORT']);
const port = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT;

async function main(): Promise<void> {
  // 起動前にマイグレーションを適用し、スキーマが揃った状態で受け付ける。
  await runMigrations(getPool());

  const app = buildDefaultApp();
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`BFF listening on http://localhost:${info.port}`);
  });
}

main().catch((error) => {
  console.error('failed to start BFF', error);
  process.exit(1);
});
