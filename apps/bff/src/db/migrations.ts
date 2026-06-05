import type { Pool } from 'pg';

/**
 * スキーママイグレーション。各要素は一度だけ適用され、適用済み id は `schema_migrations` に
 * 記録される。配列の順序が適用順であり、新規追加は末尾に積む（既存要素の id・SQL は変更しない）。
 */
export interface Migration {
  readonly id: string;
  readonly sql: string;
}

export const MIGRATIONS: readonly Migration[] = [
  {
    id: '0001_init_auth_and_favorites',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);

      CREATE TABLE IF NOT EXISTS favorites (
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pokemon_id INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, pokemon_id)
      );
    `,
  },
];

/**
 * 未適用のマイグレーションを順に適用する。各マイグレーションはトランザクション内で実行し、
 * 成功時のみ `schema_migrations` に id を記録する。適用済みは冪等にスキップする。
 */
export async function runMigrations(
  pool: Pool,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const applied = await pool.query<{ id: string }>('SELECT id FROM schema_migrations');
  const appliedIds = new Set(applied.rows.map((row) => row.id));

  for (const migration of migrations) {
    if (appliedIds.has(migration.id)) {
      continue;
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(migration.sql);
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [migration.id]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
