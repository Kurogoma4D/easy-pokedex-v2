import { runMigrations } from './db/migrations.js';
import { closePool, getPool } from './db/pool.js';

/** マイグレーションを単体で適用する CLI エントリ。`pnpm --filter bff migrate` で実行する。 */
async function main(): Promise<void> {
  await runMigrations(getPool());
  console.log('migrations applied');
  await closePool();
}

main().catch((error) => {
  console.error('migration failed', error);
  process.exit(1);
});
