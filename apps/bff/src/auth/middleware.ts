import type { Context, MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';

import type { AuthService } from './service.js';
import { SESSION_COOKIE_NAME } from './session.js';

/** Hono の Context Variables に載せる認証情報の型。保護ルートで現在ユーザー id を取り出す。 */
export interface AuthVariables {
  userId: number;
}

/**
 * セッション Cookie から現在ユーザーを解決し、未認証アクセスを 401 で拒否するミドルウェア。
 * 解決できた場合は `c.get('userId')` で参照できる。保護 API の前段に挟む。
 */
export function requireAuth(auth: AuthService): MiddlewareHandler {
  return async (c, next) => {
    const sessionId = getCookie(c, SESSION_COOKIE_NAME);
    if (sessionId === undefined || sessionId === '') {
      return c.json({ error: 'authentication required' }, 401);
    }
    const session = await auth.resolveSession(sessionId);
    if (session === null) {
      return c.json({ error: 'authentication required' }, 401);
    }
    c.set('userId', session.userId);
    await next();
    return;
  };
}

/** 保護ルート内で現在ユーザー id を取り出す。`requireAuth` を通過した後に呼ぶ前提。 */
export function getUserId(c: Context<{ Variables: AuthVariables }>): number {
  return c.get('userId');
}
