/**
 * セッション識別子と Cookie の取り扱い。
 *
 * セッション id は暗号論的乱数から生成し、HttpOnly Cookie として配布する。
 * id 自体が十分なエントロピーを持つ不透明トークンであり、サーバ側の
 * `sessions` テーブル参照で有効性を判定するため、Cookie 値そのものには署名を
 * 持たせていない（推測不能性で代替する）。`SESSION_SECRET` は将来の署名・
 * 暗号化拡張のために環境変数として保持される。
 */

import { randomBytes } from 'node:crypto';

import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';

/** セッション Cookie の名前。 */
export const SESSION_COOKIE_NAME = 'sid';

/** セッションの有効期間（秒）。Cookie の Max-Age と DB の expires_at に共通で用いる。 */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

/** 推測不能なセッション id を生成する（base64url, 256bit）。 */
export function generateSessionId(): string {
  return randomBytes(32).toString('base64url');
}

/** 現在時刻から TTL を加えたセッション有効期限を返す。 */
export function sessionExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
}

/**
 * セッション Cookie を発行する。
 * Secure は本番（NODE_ENV=production）でのみ付与し、HTTP な開発環境でも Cookie が
 * 送出されるようにする。JS からの読み取りを禁じるため HttpOnly は常に付与する。
 */
export function setSessionCookie(c: Context, sessionId: string): void {
  setCookie(c, SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

/** セッション Cookie を削除する（ログアウト）。 */
export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' });
}

/** リクエストからセッション id を読む。未設定なら undefined。 */
export function getSessionCookie(c: Context): string | undefined {
  return getCookie(c, SESSION_COOKIE_NAME);
}
