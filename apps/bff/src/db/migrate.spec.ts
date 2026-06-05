import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Sql } from './client.js';
import { migrate, splitSqlStatements } from './migrate.js';

interface FakeDb {
  /** 実際にコミットされた DDL 文（適用順）。 */
  readonly committed: string[];
  /** `schema_migrations` に記録済みのマイグレーション名。 */
  readonly recorded: Set<string>;
}

/**
 * postgres.js の最小スタブ。`begin` の中で発行された DDL（`unsafe`）と
 * `schema_migrations` への挿入をトランザクション境界で扱う。コールバックが
 * 拒否された場合はそのトランザクション内の全変更を破棄し、解決した場合のみ
 * 永続側（`committed` / `recorded`）へ反映する。これにより実 Postgres の
 * 「1 マイグレーション = 1 トランザクション、失敗時はロールバック」を模す。
 *
 * @param failOn この DDL 文が来たら例外を投げ、トランザクション失敗を再現する。
 */
function createFakeSql(failOn?: string): { sql: Sql; db: FakeDb } {
  const db: FakeDb = { committed: [], recorded: new Set<string>() };

  const topLevelQuery = (strings: TemplateStringsArray): Promise<unknown> => {
    const text = strings.join('?');
    if (text.includes('SELECT name FROM schema_migrations')) {
      return Promise.resolve([...db.recorded].map((name) => ({ name })));
    }
    return Promise.resolve([]);
  };

  const begin = async (fn: (tx: unknown) => Promise<unknown>): Promise<unknown> => {
    // トランザクション内の保留中変更。fn が解決したときだけ永続側へ反映する。
    const pendingDdl: string[] = [];
    const pendingRecords = new Set<string>();

    const txQuery = (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown> => {
      const text = strings.join('?');
      if (text.includes('INSERT INTO schema_migrations')) {
        pendingRecords.add(String(values[0]));
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    };

    const tx = Object.assign(txQuery, {
      unsafe: (raw: string): Promise<unknown> => {
        if (failOn !== undefined && raw === failOn) {
          return Promise.reject(new Error(`syntax error near: ${raw}`));
        }
        pendingDdl.push(raw);
        return Promise.resolve([]);
      },
    });

    const result = await fn(tx);
    db.committed.push(...pendingDdl);
    for (const name of pendingRecords) {
      db.recorded.add(name);
    }
    return result;
  };

  const sql = Object.assign(topLevelQuery, { begin });
  return { sql: sql as unknown as Sql, db };
}

describe('splitSqlStatements', () => {
  it('セミコロン区切りで複数文に分割し空文を除く', () => {
    expect(splitSqlStatements('CREATE TABLE a (); CREATE TABLE b ();')).toEqual([
      'CREATE TABLE a ()',
      'CREATE TABLE b ()',
    ]);
  });

  it('末尾のセミコロン有無に関わらず単一文を返す', () => {
    expect(splitSqlStatements('CREATE TABLE a ()')).toEqual(['CREATE TABLE a ()']);
    expect(splitSqlStatements('CREATE TABLE a ();\n')).toEqual(['CREATE TABLE a ()']);
  });

  it('文字列リテラル内のセミコロンでは分割しない', () => {
    expect(splitSqlStatements("INSERT INTO t (c) VALUES ('a;b'); SELECT 1")).toEqual([
      "INSERT INTO t (c) VALUES ('a;b')",
      'SELECT 1',
    ]);
  });

  it('ドル引用された本文内のセミコロンでは分割しない', () => {
    const fn = 'CREATE FUNCTION f() RETURNS void AS $$ BEGIN x; y; END $$ LANGUAGE plpgsql';
    expect(splitSqlStatements(`${fn}; SELECT 1`)).toEqual([fn, 'SELECT 1']);
  });

  it('コメント内のセミコロンでは分割しない', () => {
    expect(splitSqlStatements('SELECT 1; -- a; b\nSELECT 2')).toEqual([
      'SELECT 1',
      '-- a; b\nSELECT 2',
    ]);
  });
});

describe('migrate', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'migrate-test-'));
    await writeFile(join(dir, '0002_second.sql'), 'CREATE TABLE b ();');
    await writeFile(join(dir, '0001_first.sql'), 'CREATE TABLE a ();');
    await writeFile(join(dir, 'notes.txt'), 'ignore me');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('未適用の SQL をファイル名の辞書順に適用する', async () => {
    const { sql, db } = createFakeSql();
    const result = await migrate(sql, dir);

    expect(result.applied).toEqual(['0001_first.sql', '0002_second.sql']);
    expect(db.committed).toEqual(['CREATE TABLE a ()', 'CREATE TABLE b ()']);
    expect(db.recorded).toEqual(new Set(['0001_first.sql', '0002_second.sql']));
  });

  it('適用済みのマイグレーションは再実行しない', async () => {
    const { sql, db } = createFakeSql();
    db.recorded.add('0001_first.sql');

    const result = await migrate(sql, dir);

    expect(result.applied).toEqual(['0002_second.sql']);
    expect(db.committed).toEqual(['CREATE TABLE b ()']);
  });

  it('全て適用済みなら何も実行しない', async () => {
    const { sql, db } = createFakeSql();
    const result = await migrate(sql, dir);
    expect(result.applied).toHaveLength(2);

    const second = await migrate(sql, dir);
    expect(second.applied).toEqual([]);
    expect(db.committed).toHaveLength(2);
  });

  it('マイグレーションの全文成功後にのみ schema_migrations へ記録する', async () => {
    const { sql, db } = createFakeSql();
    await migrate(sql, dir);

    // 記録された名前は、その DDL がコミット済みである場合のみ存在する。
    expect(db.recorded).toEqual(new Set(['0001_first.sql', '0002_second.sql']));
    expect(db.committed).toEqual(['CREATE TABLE a ()', 'CREATE TABLE b ()']);
  });

  it('2 文目が失敗したら 1 文目もロールバックし schema_migrations に記録しない', async () => {
    await writeFile(join(dir, '0003_multi.sql'), 'CREATE TABLE c (); BROKEN STATEMENT;');
    // 2 文目（BROKEN STATEMENT）で失敗させ、同一トランザクション内の 1 文目の巻き戻りを検証する。
    const { sql, db } = createFakeSql('BROKEN STATEMENT');

    await expect(migrate(sql, dir)).rejects.toThrow(/BROKEN STATEMENT/);

    // 失敗したマイグレーションの 1 文目（CREATE TABLE c）はコミットされていない。
    expect(db.committed).not.toContain('CREATE TABLE c ()');
    // 失敗したマイグレーションは記録されない。
    expect(db.recorded.has('0003_multi.sql')).toBe(false);
    // 先行する成功済みマイグレーションは確定している。
    expect(db.committed).toEqual(['CREATE TABLE a ()', 'CREATE TABLE b ()']);
    expect(db.recorded).toEqual(new Set(['0001_first.sql', '0002_second.sql']));
  });
});
