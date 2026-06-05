/**
 * `FavoriteRepository` の Postgres 実装。
 *
 * 登録は `ON CONFLICT DO NOTHING` で冪等にし、主キー (user_id, pokemon_id) の
 * 重複でエラーにしない。`sql` は関数として遅延解決し、認証リポジトリと同様に
 * リクエスト処理まで DB クライアントの初期化を遅らせる。
 */

import type { Sql } from '../db/client.js';
import type { FavoriteRecord, FavoriteRepository } from './repository.js';

interface FavoriteRow {
  readonly pokemon_id: number;
  readonly created_at: Date;
}

export function createPgFavoriteRepository(getSql: () => Sql): FavoriteRepository {
  return {
    async add(userId, pokemonId) {
      const sql = getSql();
      await sql`
        INSERT INTO favorites (user_id, pokemon_id)
        VALUES (${userId}, ${pokemonId})
        ON CONFLICT (user_id, pokemon_id) DO NOTHING
      `;
    },

    async remove(userId, pokemonId) {
      const sql = getSql();
      await sql`
        DELETE FROM favorites WHERE user_id = ${userId} AND pokemon_id = ${pokemonId}
      `;
    },

    async list(userId) {
      const sql = getSql();
      const rows = await sql<FavoriteRow[]>`
        SELECT pokemon_id, created_at
        FROM favorites
        WHERE user_id = ${userId}
        ORDER BY created_at DESC, pokemon_id DESC
      `;
      return rows.map(
        (row): FavoriteRecord => ({ pokemonId: row.pokemon_id, createdAt: row.created_at }),
      );
    },
  };
}
