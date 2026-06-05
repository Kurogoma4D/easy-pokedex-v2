/**
 * 認証ミドルウェア。
 *
 * セッション Cookie から現在のユーザーを解決し、Hono のコンテキスト変数
 * （`c.get('user')`）に格納する。`requireAuth` は未認証アクセスを 401 で拒否し、
 * 保護 API のゲートとして用いる。後続パートのお気に入り API もこれを再利用する。
 */

import { createMiddleware } from 'hono/factory';

import type { AuthenticatedUser, AuthService } from './service.js';
import { getSessionCookie } from './session.js';

/** 認証ミドルウェアがコンテキストへ格納する変数の型。 */
export interface AuthVariables {
  user: AuthenticatedUser | null;
}

/**
 * セッションを解決してコンテキストへ格納する。未認証でも素通しし、`user` を null にする。
 * 認証必須かどうかは `requireAuth` で別途ゲートする。
 */
export function sessionResolver(service: AuthService) {
  return createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const sessionId = getSessionCookie(c);
    const user = sessionId !== undefined ? await service.resolveUser(sessionId) : null;
    c.set('user', user);
    await next();
  });
}

/** 認証必須のルートをゲートする。`sessionResolver` の後段で用いる。 */
export function requireAuth() {
  return createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    if (c.get('user') === null) {
      return c.json({ error: 'authentication required' }, 401);
    }
    await next();
    return undefined;
  });
}
