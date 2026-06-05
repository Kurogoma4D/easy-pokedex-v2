/**
 * 認証 API（登録・ログイン・ログアウト・現在ユーザー取得）。
 *
 * ビジネスロジックは `AuthService` に委ね、本ルートは HTTP 表現
 * （リクエスト本文の取り出し・ステータス・セッション Cookie）への写像に限る。
 * 認証必須の `/me` `/logout` は `requireAuth` でゲートする。
 */

import { type Context, Hono } from 'hono';

import type { AuthService, AuthVariables } from '../auth/index.js';
import {
  clearSessionCookie,
  getSessionCookie,
  requireAuth,
  setSessionCookie,
} from '../auth/index.js';

interface CredentialsBody {
  email?: unknown;
  password?: unknown;
}

/** リクエスト本文を JSON として安全に読む。本文不正時は空オブジェクトへ倒す。 */
async function readCredentials(c: Context): Promise<CredentialsBody> {
  try {
    const body = (await c.req.json()) as unknown;
    if (typeof body === 'object' && body !== null) {
      return body as CredentialsBody;
    }
  } catch {
    // 本文が JSON でない場合はバリデーションで弾く。
  }
  return {};
}

export function createAuthRoutes(service: AuthService): Hono<{ Variables: AuthVariables }> {
  const routes = new Hono<{ Variables: AuthVariables }>();

  routes.post('/register', async (c) => {
    const { email, password } = await readCredentials(c);
    const result = await service.register({ email, password });

    if (!result.ok) {
      if (result.kind === 'duplicate') {
        return c.json({ error: 'email already registered' }, 409);
      }
      return c.json({ error: 'invalid input', details: result.errors }, 400);
    }

    setSessionCookie(c, result.session.sessionId);
    return c.json({ user: result.user }, 201);
  });

  routes.post('/login', async (c) => {
    const { email, password } = await readCredentials(c);
    const result = await service.login({ email, password });

    if (!result.ok) {
      if (result.kind === 'invalid_credentials') {
        return c.json({ error: 'invalid email or password' }, 401);
      }
      return c.json({ error: 'invalid input', details: result.errors }, 400);
    }

    setSessionCookie(c, result.session.sessionId);
    return c.json({ user: result.user }, 200);
  });

  routes.post('/logout', async (c) => {
    const sessionId = getSessionCookie(c);
    if (sessionId !== undefined) {
      await service.logout(sessionId);
    }
    clearSessionCookie(c);
    return c.body(null, 204);
  });

  routes.get('/me', requireAuth(), (c) => {
    return c.json({ user: c.get('user') });
  });

  return routes;
}
