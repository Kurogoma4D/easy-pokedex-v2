import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Sql } from './client.js';
import { migrate } from './migrate.js';

/**
 * postgres.js の最小スタブ。tagged-template 呼び出しと `begin` / `unsafe` を記録し、
 * `schema_migrations` への参照・挿入だけをインメモリで再現する。
 */
function createFakeSql(): { sql: Sql; ran: string[]; applied: Set<string> } {
  const applied = new Set<string>();
  const ran: string[] = [];

  const query = (strings: TemplateStringsArray, ...values: unknown[]): unknown => {
    const text = strings.join('?');
    if (text.includes('SELECT name FROM schema_migrations')) {
      return Promise.resolve([...applied].map((name) => ({ name })));
    }
    if (text.includes('INSERT INTO schema_migrations')) {
      applied.add(String(values[0]));
      return Promise.resolve([]);
    }
    return Promise.resolve([]);
  };

  const tx = Object.assign(query, {
    unsafe: (raw: string) => {
      ran.push(raw);
      return Promise.resolve([]);
    },
  });

  const sql = Object.assign(query, {
    begin: (fn: (tx: unknown) => Promise<unknown>) => fn(tx),
  });

  return { sql: sql as unknown as Sql, ran, applied };
}

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
    const { sql, ran, applied } = createFakeSql();
    const result = await migrate(sql, dir);

    expect(result.applied).toEqual(['0001_first.sql', '0002_second.sql']);
    expect(ran).toEqual(['CREATE TABLE a ();', 'CREATE TABLE b ();']);
    expect(applied).toEqual(new Set(['0001_first.sql', '0002_second.sql']));
  });

  it('適用済みのマイグレーションは再実行しない', async () => {
    const { sql, ran, applied } = createFakeSql();
    applied.add('0001_first.sql');

    const result = await migrate(sql, dir);

    expect(result.applied).toEqual(['0002_second.sql']);
    expect(ran).toEqual(['CREATE TABLE b ();']);
  });

  it('全て適用済みなら何も実行しない', async () => {
    const { sql, ran } = createFakeSql();
    const result = await migrate(sql, dir);
    expect(result.applied).toHaveLength(2);

    const second = await migrate(sql, dir);
    expect(second.applied).toEqual([]);
    expect(ran).toHaveLength(2);
  });
});
