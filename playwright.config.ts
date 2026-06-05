import { defineConfig, devices } from '@playwright/test';

/**
 * ブラウザ実機での E2E ハーネス。
 *
 * Angular アプリ（apps/web）を `ng serve` で配信し、Chromium で操作する。BFF（`/api/**`）への
 * 通信はブラウザ層の `page.route` で都度スタブするため（specs/fixtures 参照）、本物の Hono BFF も
 * 上流の PokeAPI も起動・到達せずに決定論的に走る。`ng serve` の dev プロキシは `/api` を BFF へ
 * 転送する設定だが、ルート傍受がブラウザ側で先に応答するためプロキシ経路には到達しない。
 */
const WEB_PORT = 4200;
const BASE_URL = `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `pnpm --filter web start --port ${WEB_PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
