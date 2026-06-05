import { describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';

import { runMigrations, type Migration } from './migrations.js';

/**
 * `runMigrations` の適用順・冪等性・トランザクション境界を、`pg` の Pool/Client を模した
 * フェイクで検証する。実際の Postgres には接続しない。
 */
function createFakePool(initiallyApplied: string[]): {
  pool: Pool;
  insertedIds: string[];
  clientCommands: string[];
} {
  const applied = new Set(initiallyApplied);
  const insertedIds: string[] = [];
  const clientCommands: string[] = [];

  const client = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      clientCommands.push(sql.trim().split(/\s+/)[0]!);
      if (sql.startsWith('INSERT INTO schema_migrations')) {
        const id = (params as string[])[0]!;
        applied.add(id);
        insertedIds.push(id);
      }
      return { rows: [], rowCount: 0 };
    }),
    release: vi.fn(),
  } as unknown as PoolClient;

  const pool = {
    query: vi.fn(async (sql: string) => {
      if (sql.includes('SELECT id FROM schema_migrations')) {
        return { rows: [...applied].map((id) => ({ id })), rowCount: applied.size };
      }
      return { rows: [], rowCount: 0 };
    }),
    connect: vi.fn(async () => client),
  } as unknown as Pool;

  return { pool, insertedIds, clientCommands };
}

const migrations: readonly Migration[] = [
  { id: 'm1', sql: 'CREATE TABLE a();' },
  { id: 'm2', sql: 'CREATE TABLE b();' },
];

describe('runMigrations', () => {
  it('applies all pending migrations in order within a transaction', async () => {
    const { pool, insertedIds, clientCommands } = createFakePool([]);
    await runMigrations(pool, migrations);

    expect(insertedIds).toEqual(['m1', 'm2']);
    expect(clientCommands).toContain('BEGIN');
    expect(clientCommands).toContain('COMMIT');
  });

  it('skips already-applied migrations', async () => {
    const { pool, insertedIds } = createFakePool(['m1']);
    await runMigrations(pool, migrations);
    expect(insertedIds).toEqual(['m2']);
  });
});
