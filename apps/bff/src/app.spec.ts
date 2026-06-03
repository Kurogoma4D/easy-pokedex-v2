import { describe, expect, it } from 'vitest';

import { app } from './app.js';

describe('BFF app', () => {
  it('responds to the health check', async () => {
    const res = await app.request('/health');

    expect(res.status).toBe(200);

    const body = (await res.json()) as { status: string; service: string };
    expect(body.status).toBe('ok');
    expect(body.service).toBe('bff');
  });

  it('returns 404 for unknown routes', async () => {
    const res = await app.request('/does-not-exist');
    expect(res.status).toBe(404);
  });
});
