/**
 * ファイルベースのマイグレーション機構。
 *
 * `migrations/` 配下の `*.sql` をファイル名の辞書順に適用し、適用済みの名前を
 * `schema_migrations` テーブルに記録する。各マイグレーションは 1 トランザクション内で
 * 実行し、途中で失敗した場合はそのファイルの変更をロールバックする。
 */

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Sql } from './client.js';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

interface Migration {
  readonly name: string;
  readonly sql: string;
}

async function loadMigrations(dir: string): Promise<Migration[]> {
  const entries = await readdir(dir);
  const files = entries.filter((name) => name.endsWith('.sql')).sort();
  return Promise.all(
    files.map(async (name) => ({
      name,
      sql: await readFile(join(dir, name), 'utf8'),
    })),
  );
}

async function ensureMigrationsTable(sql: Sql): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

async function appliedNames(sql: Sql): Promise<Set<string>> {
  const rows = await sql<{ name: string }[]>`SELECT name FROM schema_migrations`;
  return new Set(rows.map((row) => row.name));
}

export interface MigrateResult {
  /** 今回適用したマイグレーションのファイル名。既に最新なら空配列。 */
  readonly applied: string[];
}

/**
 * 未適用のマイグレーションを順に適用する。
 * @param dir マイグレーション SQL を格納したディレクトリ（既定はビルド成果物に同梱した `migrations/`）。
 */
export async function migrate(sql: Sql, dir: string = MIGRATIONS_DIR): Promise<MigrateResult> {
  await ensureMigrationsTable(sql);
  const migrations = await loadMigrations(dir);
  const done = await appliedNames(sql);
  const applied: string[] = [];

  for (const migration of migrations) {
    if (done.has(migration.name)) {
      continue;
    }
    await sql.begin(async (tx) => {
      await tx.unsafe(migration.sql);
      await tx`INSERT INTO schema_migrations (name) VALUES (${migration.name})`;
    });
    applied.push(migration.name);
  }

  return { applied };
}
