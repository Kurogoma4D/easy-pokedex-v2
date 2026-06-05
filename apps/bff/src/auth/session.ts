import { randomBytes } from 'node:crypto';

/** セッション Cookie の名前。 */
export const SESSION_COOKIE_NAME = 'pdx_session';

/** セッションの有効期間（ミリ秒）。発行時から 7 日。 */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** 推測困難なセッション id を生成する（256bit のランダム値を hex 化）。 */
export function generateSessionId(): string {
  return randomBytes(32).toString('hex');
}

/** 発行時刻から有効期限を算出する。 */
export function sessionExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + SESSION_TTL_MS);
}
