import { Pool } from 'pg';

/**
 * プロセス内で共有する単一の Postgres コネクションプール。
 * 接続情報は `DATABASE_URL` 環境変数から取得する。未設定なら起動時に失敗させ、
 * DB なしで認証・お気に入り機能が中途半端に動くのを防ぐ。
 */
let pool: Pool | undefined;

export function getPool(): Pool {
  if (pool === undefined) {
    const connectionString = process.env['DATABASE_URL'];
    if (connectionString === undefined || connectionString === '') {
      throw new Error('DATABASE_URL is not set');
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

/** テスト・終了処理用にプールを破棄する。 */
export async function closePool(): Promise<void> {
  if (pool !== undefined) {
    await pool.end();
    pool = undefined;
  }
}
