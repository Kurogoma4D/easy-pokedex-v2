/**
 * ファイルベースのマイグレーション機構。
 *
 * `migrations/` 配下の `*.sql` をファイル名の辞書順に適用し、適用済みの名前を
 * `schema_migrations` テーブルに記録する。各マイグレーションは 1 トランザクション内で
 * 実行し、途中で失敗した場合はそのファイルの変更をロールバックする。
 *
 * SQL は文単位に分割してトランザクション接続上で 1 文ずつ発行する。`schema_migrations`
 * への記録はマイグレーション内の全文が成功した後に同一トランザクションで行うため、
 * 失敗時は DDL の適用も記録もまとめてロールバックされる。
 */

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Sql } from './client.js';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

interface Migration {
  readonly name: string;
  readonly statements: string[];
}

/**
 * SQL ファイルを文と文の区切り（セミコロン）で分割する。
 *
 * 各文を個別に発行することで、postgres.js の `unsafe()` に複数文を渡したときの
 * simple query protocol（暗黙の自動コミットが絡み、明示トランザクションの境界を
 * 跨ぐ恐れがある）を避け、`begin` 配下のトランザクション接続上で 1 文ずつ実行する。
 * これにより途中の文が失敗しても、それまでの文を含めてロールバックできる。
 *
 * 文字列リテラル・引用符付き識別子・ドル引用・各種コメント内のセミコロンは
 * 区切りとして扱わない。
 */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    // 行コメント
    if (ch === '-' && next === '-') {
      const end = sql.indexOf('\n', i);
      const stop = end === -1 ? sql.length : end;
      current += sql.slice(i, stop);
      i = stop;
      continue;
    }

    // ブロックコメント
    if (ch === '/' && next === '*') {
      const end = sql.indexOf('*/', i + 2);
      const stop = end === -1 ? sql.length : end + 2;
      current += sql.slice(i, stop);
      i = stop;
      continue;
    }

    // 単一引用符の文字列リテラル
    if (ch === "'") {
      const end = findQuoteEnd(sql, i, "'");
      current += sql.slice(i, end);
      i = end;
      continue;
    }

    // 二重引用符の識別子
    if (ch === '"') {
      const end = findQuoteEnd(sql, i, '"');
      current += sql.slice(i, end);
      i = end;
      continue;
    }

    // ドル引用（$tag$ ... $tag$）
    if (ch === '$') {
      const tagMatch = /^\$[A-Za-z0-9_]*\$/.exec(sql.slice(i));
      if (tagMatch !== null) {
        const tag = tagMatch[0];
        const end = sql.indexOf(tag, i + tag.length);
        const stop = end === -1 ? sql.length : end + tag.length;
        current += sql.slice(i, stop);
        i = stop;
        continue;
      }
    }

    if (ch === ';') {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      current = '';
      i += 1;
      continue;
    }

    current += ch;
    i += 1;
  }

  const tail = current.trim();
  if (tail.length > 0) {
    statements.push(tail);
  }
  return statements;
}

/** 開始引用符 `sql[start]` に対応する閉じ引用符の直後位置を返す。エスケープは二重化で表現される。 */
function findQuoteEnd(sql: string, start: number, quote: string): number {
  let i = start + 1;
  while (i < sql.length) {
    if (sql[i] === quote) {
      if (sql[i + 1] === quote) {
        i += 2;
        continue;
      }
      return i + 1;
    }
    i += 1;
  }
  return sql.length;
}

async function loadMigrations(dir: string): Promise<Migration[]> {
  const entries = await readdir(dir);
  const files = entries.filter((name) => name.endsWith('.sql')).sort();
  return Promise.all(
    files.map(async (name) => ({
      name,
      statements: splitSqlStatements(await readFile(join(dir, name), 'utf8')),
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
      for (const statement of migration.statements) {
        await tx.unsafe(statement);
      }
      await tx`INSERT INTO schema_migrations (name) VALUES (${migration.name})`;
    });
    applied.push(migration.name);
  }

  return { applied };
}
