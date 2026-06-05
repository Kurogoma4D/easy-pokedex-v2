import { beforeEach, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';

import { createTestApp } from '../test-app.js';

function sessionCookieValue(res: Response): string {
  const match = /pdx_session=([^;]*)/.exec(res.headers.get('set-cookie') ?? '');
  return match?.[1] ?? '';
}

async function registerAndCookie(app: Hono, email: string): Promise<string> {
  const res = await app.request('/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123' }),
  });
  return `pdx_session=${sessionCookieValue(res)}`;
}

describe('favorites routes', () => {
  let app: Hono;
  let cookie: string;

  beforeEach(async () => {
    ({ app } = createTestApp());
    cookie = await registerAndCookie(app, 'owner@example.com');
  });

  it('rejects unauthenticated access', async () => {
    expect((await app.request('/favorites')).status).toBe(401);
    expect((await app.request('/favorites/25', { method: 'PUT' })).status).toBe(401);
    expect((await app.request('/favorites/25', { method: 'DELETE' })).status).toBe(401);
  });

  it('adds, lists and removes favorites for the logged-in user', async () => {
    const headers = { cookie };

    const empty = await app.request('/favorites', { headers });
    expect(((await empty.json()) as { pokemonIds: number[] }).pokemonIds).toEqual([]);

    await app.request('/favorites/1', { method: 'PUT', headers });
    await app.request('/favorites/25', { method: 'PUT', headers });

    const listed = await app.request('/favorites', { headers });
    const body = (await listed.json()) as { pokemonIds: number[] };
    expect(body.pokemonIds).toContain(1);
    expect(body.pokemonIds).toContain(25);

    await app.request('/favorites/1', { method: 'DELETE', headers });
    const afterRemove = await app.request('/favorites', { headers });
    const remaining = (await afterRemove.json()) as { pokemonIds: number[] };
    expect(remaining.pokemonIds).toEqual([25]);
  });

  it('is idempotent on repeated add', async () => {
    const headers = { cookie };
    await app.request('/favorites/7', { method: 'PUT', headers });
    await app.request('/favorites/7', { method: 'PUT', headers });
    const listed = await app.request('/favorites', { headers });
    const body = (await listed.json()) as { pokemonIds: number[] };
    expect(body.pokemonIds).toEqual([7]);
  });

  it('rejects invalid pokemon ids', async () => {
    const headers = { cookie };
    expect((await app.request('/favorites/abc', { method: 'PUT', headers })).status).toBe(400);
    expect((await app.request('/favorites/0', { method: 'PUT', headers })).status).toBe(400);
  });

  it('isolates favorites per user', async () => {
    const otherCookie = await registerAndCookie(app, 'other@example.com');
    await app.request('/favorites/1', { method: 'PUT', headers: { cookie } });

    const otherList = await app.request('/favorites', { headers: { cookie: otherCookie } });
    expect(((await otherList.json()) as { pokemonIds: number[] }).pokemonIds).toEqual([]);
  });
});
