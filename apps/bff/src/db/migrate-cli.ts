/**
 * マイグレーションを CLI から適用するエントリポイント。
 * `pnpm --filter bff migrate`（dev は tsx、本番は dist 経由）で実行する。
 */

import { closeDbClient, getDbClient } from './client.js';
import { migrate } from './migrate.js';

async function main(): Promise<void> {
  const sql = getDbClient();
  try {
    const { applied } = await migrate(sql);
    if (applied.length === 0) {
      console.log('No pending migrations. Database is up to date.');
    } else {
      console.log(`Applied ${applied.length} migration(s):`);
      for (const name of applied) {
        console.log(`  - ${name}`);
      }
    }
  } finally {
    await closeDbClient();
  }
}

main().catch(async (error: unknown) => {
  console.error('Migration failed:', error);
  process.exitCode = 1;
  try {
    await closeDbClient();
  } catch (closeError: unknown) {
    console.error('Failed to close DB client:', closeError);
  }
});
