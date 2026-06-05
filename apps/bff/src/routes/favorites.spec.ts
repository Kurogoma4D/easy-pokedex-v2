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

const JSON_HEADERS = { 'content-type': 'application/json' };

/** Set-Cookie からセッション Cookie（`sid=...`）を抽出する。 */
function extractSessionCookie(res: Response): string | undefined {
  const setCookie = res.headers.get('set-cookie');
  if (setCookie === null) {
    return undefined;
  }
  const match = /(?:^|, )(sid=[^;]+)/.exec(setCookie);
  return match?.[1];
}

/** ユーザーを登録し、認証済みリクエストに使うセッション Cookie を返す。 */
async function registerAndGetCookie(app: App, email: string): Promise<string> {
  const res = await app.request('/auth/register', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ email, password: 'password123' }),
  });
  const cookie = extractSessionCookie(res);
  if (cookie === undefined) {
    throw new Error('session cookie not issued');
  }
  return cookie;
}

interface FavoritesResponse {
  favorites: { pokemonId: number }[];
}

describe('favorites routes', () => {
  let app: App;

  beforeEach(() => {
    app = buildApp();
  });

  describe('未認証アクセスの拒否', () => {
    it('GET /favorites は 401 を返す', async () => {
      const res = await app.request('/favorites');
      expect(res.status).toBe(401);
    });

    it('POST /favorites は 401 を返す', async () => {
      const res = await app.request('/favorites', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ pokemonId: 25 }),
      });
      expect(res.status).toBe(401);
    });

    it('DELETE /favorites/:id は 401 を返す', async () => {
      const res = await app.request('/favorites/25', { method: 'DELETE' });
      expect(res.status).toBe(401);
    });

    it('未認証の登録試行はお気に入りを永続化しない', async () => {
      await app.request('/favorites', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ pokemonId: 25 }),
      });

      const cookie = await registerAndGetCookie(app, 'guest-check@example.com');
      const res = await app.request('/favorites', { headers: { cookie } });
      const body = (await res.json()) as FavoritesResponse;
      expect(body.favorites).toEqual([]);
    });
  });

  describe('認証済みの操作', () => {
    it('登録すると 204 を返し一覧に現れる', async () => {
      const cookie = await registerAndGetCookie(app, 'fav@example.com');

      const add = await app.request('/favorites', {
        method: 'POST',
        headers: { ...JSON_HEADERS, cookie },
        body: JSON.stringify({ pokemonId: 25 }),
      });
      expect(add.status).toBe(204);

      const list = await app.request('/favorites', { headers: { cookie } });
      expect(list.status).toBe(200);
      const body = (await list.json()) as FavoritesResponse;
      expect(body.favorites).toEqual([{ pokemonId: 25 }]);
    });

    it('解除すると 204 を返し一覧から消える', async () => {
      const cookie = await registerAndGetCookie(app, 'remove@example.com');
      await app.request('/favorites', {
        method: 'POST',
        headers: { ...JSON_HEADERS, cookie },
        body: JSON.stringify({ pokemonId: 25 }),
      });

      const del = await app.request('/favorites/25', { method: 'DELETE', headers: { cookie } });
      expect(del.status).toBe(204);

      const list = await app.request('/favorites', { headers: { cookie } });
      const body = (await list.json()) as FavoritesResponse;
      expect(body.favorites).toEqual([]);
    });

    it('不正な pokemonId の登録は 400 を返す', async () => {
      const cookie = await registerAndGetCookie(app, 'invalid@example.com');
      const res = await app.request('/favorites', {
        method: 'POST',
        headers: { ...JSON_HEADERS, cookie },
        body: JSON.stringify({ pokemonId: 'pikachu' }),
      });
      expect(res.status).toBe(400);
    });

    it('不正な pokemonId の解除は 400 を返す', async () => {
      const cookie = await registerAndGetCookie(app, 'invalid-del@example.com');
      const res = await app.request('/favorites/abc', { method: 'DELETE', headers: { cookie } });
      expect(res.status).toBe(400);
    });

    it('別ユーザーのお気に入りは見えない', async () => {
      const cookieA = await registerAndGetCookie(app, 'a@example.com');
      const cookieB = await registerAndGetCookie(app, 'b@example.com');

      await app.request('/favorites', {
        method: 'POST',
        headers: { ...JSON_HEADERS, cookie: cookieA },
        body: JSON.stringify({ pokemonId: 25 }),
      });

      const listB = await app.request('/favorites', { headers: { cookie: cookieB } });
      const body = (await listB.json()) as FavoritesResponse;
      expect(body.favorites).toEqual([]);
    });
  });
});
