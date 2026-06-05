/**
 * `AuthRepository` のインメモリ実装。テスト専用で、DB を起動せずに
 * 認証ロジック（登録・ログイン・セッション解決）を検証するために用いる。
 *
 * メール一意性は小文字化したキーで判定し、Postgres 実装と同じく
 * `DuplicateEmailError` を投げる。
 */

import {
  type AuthRepository,
  DuplicateEmailError,
  type SessionRecord,
  type UserRecord,
} from './repository.js';

export function createMemoryAuthRepository(): AuthRepository {
  const usersById = new Map<number, UserRecord>();
  const userIdByEmail = new Map<string, number>();
  const sessions = new Map<string, SessionRecord>();
  let nextId = 1;

  return {
    createUser(email, passwordHash) {
      const key = email.toLowerCase();
      if (userIdByEmail.has(key)) {
        return Promise.reject(new DuplicateEmailError());
      }
      const user: UserRecord = { id: nextId++, email, passwordHash };
      usersById.set(user.id, user);
      userIdByEmail.set(key, user.id);
      return Promise.resolve(user);
    },

    findUserByEmail(email) {
      const id = userIdByEmail.get(email.toLowerCase());
      return Promise.resolve(id !== undefined ? (usersById.get(id) ?? null) : null);
    },

    findUserById(id) {
      return Promise.resolve(usersById.get(id) ?? null);
    },

    createSession(id, userId, expiresAt) {
      sessions.set(id, { id, userId, expiresAt });
      return Promise.resolve();
    },

    findValidSession(id, now) {
      const session = sessions.get(id);
      if (session === undefined || session.expiresAt <= now) {
        return Promise.resolve(null);
      }
      return Promise.resolve(session);
    },

    deleteSession(id) {
      sessions.delete(id);
      return Promise.resolve();
    },
  };
}
