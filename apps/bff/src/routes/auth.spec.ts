import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { AuthService, createMemoryAuthRepository } from '../auth/index.js';
import { FavoriteService, createMemoryFavoriteRepository } from '../favorites/index.js';
import { PokeApiClient } from '../pokeapi/index.js';

type App = ReturnType<typeof createApp>;

function buildApp(): App {
  return createApp({
    authService: new AuthService(createMemoryAuthRepository()),
    favoriteService: new FavoriteService(createMemoryFavoriteRepository()),
    pokeApiClient: new PokeApiClient(),
  });
}

/** Set-Cookie からセッション Cookie を抽出する。リクエスト送信用に `name=value` を返す。 */
function extractSessionCookie(res: Response): string | undefined {
  const setCookie = res.headers.get('set-cookie');
  if (setCookie === null) {
    return undefined;
  }
  const match = /(?:^|, )(sid=[^;]+)/.exec(setCookie);
  return match?.[1];
}

describe('auth routes', () => {
  let app: App;

  beforeEach(() => {
    app = buildApp();
  });

  it('登録成功時に 201 と HttpOnly セッション Cookie を返す', async () => {
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'new@example.com', password: 'password123' }),
    });

    expect(res.status).toBe(201);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('sid=');
    expect(setCookie?.toLowerCase()).toContain('httponly');
    const body = (await res.json()) as { user: { email: string } };
    expect(body.user.email).toBe('new@example.com');
  });

  it('不正なメール形式の登録は 400 を返す', async () => {
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'invalid', password: 'password123' }),
    });
    expect(res.status).toBe(400);
  });

  it('短すぎるパスワードの登録は 400 を返す', async () => {
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@example.com', password: 'short' }),
    });
    expect(res.status).toBe(400);
  });

  it('重複メールの登録は 409 を返す', async () => {
    const payload = JSON.stringify({ email: 'dup@example.com', password: 'password123' });
    const headers = { 'content-type': 'application/json' };
    await app.request('/auth/register', { method: 'POST', headers, body: payload });
    const res = await app.request('/auth/register', { method: 'POST', headers, body: payload });
    expect(res.status).toBe(409);
  });

  it('登録済みユーザーはログインでき 200 と Cookie を受け取る', async () => {
    const headers = { 'content-type': 'application/json' };
    await app.request('/auth/register', {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: 'login@example.com', password: 'password123' }),
    });

    const res = await app.request('/auth/login', {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: 'login@example.com', password: 'password123' }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('sid=');
  });

  it('誤った資格情報のログインは 401 を返す', async () => {
    const headers = { 'content-type': 'application/json' };
    await app.request('/auth/register', {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: 'login@example.com', password: 'password123' }),
    });

    const res = await app.request('/auth/login', {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: 'login@example.com', password: 'wrong-password' }),
    });
    expect(res.status).toBe(401);
  });

  it('未認証の /me は 401 を返す', async () => {
    const res = await app.request('/auth/me');
    expect(res.status).toBe(401);
  });

  it('セッション Cookie 付きの /me は現在ユーザーを返す', async () => {
    const reg = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'me@example.com', password: 'password123' }),
    });
    const cookie = extractSessionCookie(reg);
    expect(cookie).toBeDefined();

    const res = await app.request('/auth/me', { headers: { cookie: cookie! } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { email: string } };
    expect(body.user.email).toBe('me@example.com');
  });

  it('ログアウト後はセッションが無効化され /me が 401 になる', async () => {
    const reg = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'out@example.com', password: 'password123' }),
    });
    const cookie = extractSessionCookie(reg);
    expect(cookie).toBeDefined();

    const logout = await app.request('/auth/logout', {
      method: 'POST',
      headers: { cookie: cookie! },
    });
    expect(logout.status).toBe(204);

    const me = await app.request('/auth/me', { headers: { cookie: cookie! } });
    expect(me.status).toBe(401);
  });
});
