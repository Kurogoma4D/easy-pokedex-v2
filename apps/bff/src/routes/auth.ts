import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { CookieOptions } from 'hono/utils/cookie';

import { requireAuth, type AuthVariables } from '../auth/middleware.js';
import type { AuthService } from '../auth/service.js';
import { SESSION_COOKIE_NAME, SESSION_TTL_MS } from '../auth/session.js';
import { validateCredentials } from '../auth/validation.js';

/**
 * セッション Cookie の属性。HttpOnly でスクリプトから読めなくし、SameSite=Lax で CSRF を抑える。
 * `secure` は本番（NODE_ENV=production）でのみ付け、ローカルの HTTP 開発を妨げない。
 */
function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'Lax',
    secure: process.env['NODE_ENV'] === 'production',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

function publicUser(user: { id: number; email: string }): { id: number; email: string } {
  return { id: user.id, email: user.email };
}

export function createAuthRoutes(auth: AuthService): Hono<{ Variables: AuthVariables }> {
  const routes = new Hono<{ Variables: AuthVariables }>();

  // アカウント登録。メール形式・パスワード長を検証し、重複メールは 409 で拒否する。
  routes.post('/register', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (body === null || typeof body !== 'object') {
      return c.json({ error: 'invalid request body' }, 400);
    }
    const validated = validateCredentials(body as Record<string, unknown>);
    if (!validated.ok) {
      return c.json({ error: validated.error }, 400);
    }

    const user = await auth.register(validated.value.email, validated.value.password);
    if (user === null) {
      return c.json({ error: 'email already registered' }, 409);
    }

    const sessionId = await auth.issueSession(user.id);
    setCookie(c, SESSION_COOKIE_NAME, sessionId, sessionCookieOptions());
    return c.json({ user: publicUser(user) }, 201);
  });

  // ログイン。認証成功時に HttpOnly セッション Cookie を発行する。
  routes.post('/login', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (body === null || typeof body !== 'object') {
      return c.json({ error: 'invalid request body' }, 400);
    }
    const validated = validateCredentials(body as Record<string, unknown>);
    if (!validated.ok) {
      return c.json({ error: 'invalid credentials' }, 401);
    }

    const user = await auth.authenticate(validated.value.email, validated.value.password);
    if (user === null) {
      return c.json({ error: 'invalid credentials' }, 401);
    }

    const sessionId = await auth.issueSession(user.id);
    setCookie(c, SESSION_COOKIE_NAME, sessionId, sessionCookieOptions());
    return c.json({ user: publicUser(user) });
  });

  // ログアウト。セッションを破棄して Cookie を削除する。未ログインでも 204 を返す（冪等）。
  routes.post('/logout', async (c) => {
    const sessionId = getCookie(c, SESSION_COOKIE_NAME);
    if (sessionId !== undefined && sessionId !== '') {
      await auth.revokeSession(sessionId);
    }
    deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' });
    return c.body(null, 204);
  });

  // 現在ユーザーの取得。保護ルートで、未認証は 401。
  routes.get('/me', requireAuth(auth), async (c) => {
    const user = await auth.findUser(c.get('userId'));
    if (user === null) {
      return c.json({ error: 'authentication required' }, 401);
    }
    return c.json({ user: publicUser(user) });
  });

  return routes;
}
