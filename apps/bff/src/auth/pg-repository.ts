/**
 * `AuthRepository` の Postgres 実装。
 *
 * メールの一意性は DB の `users_email_lower_key` インデックスで担保し、
 * 競合時の `23505`（unique_violation）を `DuplicateEmailError` に写像する。
 * これにより並行登録でもアプリ側の存在チェックに頼らず重複を確実に弾ける。
 */

import type { Sql } from '../db/client.js';
import {
  type AuthRepository,
  DuplicateEmailError,
  type SessionRecord,
  type UserRecord,
} from './repository.js';

interface UserRow {
  readonly id: string;
  readonly email: string;
  readonly password_hash: string;
}

interface SessionRow {
  readonly id: string;
  readonly user_id: string;
  readonly expires_at: Date;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

function toUser(row: UserRow): UserRecord {
  // BIGINT は postgres.js が文字列で返すため数値へ変換する。id は 2^53 を超えない想定。
  return { id: Number(row.id), email: row.email, passwordHash: row.password_hash };
}

/**
 * Postgres 認証リポジトリを生成する。
 *
 * `sql` は関数として遅延解決する。アプリ起動時（モジュール読み込み時）に
 * 接続情報の有無へ依存せず、実際にクエリを発行するリクエスト処理まで
 * DB クライアントの初期化を遅らせるため。
 */
export function createPgAuthRepository(getSql: () => Sql): AuthRepository {
  return {
    async createUser(email, passwordHash) {
      const sql = getSql();
      try {
        const rows = await sql<UserRow[]>`
          INSERT INTO users (email, password_hash)
          VALUES (${email}, ${passwordHash})
          RETURNING id, email, password_hash
        `;
        return toUser(rows[0]);
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new DuplicateEmailError();
        }
        throw error;
      }
    },

    async findUserByEmail(email) {
      const sql = getSql();
      const rows = await sql<UserRow[]>`
        SELECT id, email, password_hash FROM users WHERE lower(email) = lower(${email})
      `;
      return rows.length > 0 ? toUser(rows[0]) : null;
    },

    async findUserById(id) {
      const sql = getSql();
      const rows = await sql<UserRow[]>`
        SELECT id, email, password_hash FROM users WHERE id = ${id}
      `;
      return rows.length > 0 ? toUser(rows[0]) : null;
    },

    async createSession(id, userId, expiresAt) {
      const sql = getSql();
      await sql`
        INSERT INTO sessions (id, user_id, expires_at)
        VALUES (${id}, ${userId}, ${expiresAt})
      `;
    },

    async findValidSession(id, now): Promise<SessionRecord | null> {
      const sql = getSql();
      const rows = await sql<SessionRow[]>`
        SELECT id, user_id, expires_at
        FROM sessions
        WHERE id = ${id} AND expires_at > ${now}
      `;
      if (rows.length === 0) {
        return null;
      }
      const row = rows[0];
      return { id: row.id, userId: Number(row.user_id), expiresAt: row.expires_at };
    },

    async deleteSession(id) {
      const sql = getSql();
      await sql`DELETE FROM sessions WHERE id = ${id}`;
    },
  };
}
