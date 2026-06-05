/**
 * Postgres への接続を司る DB アクセス層。
 *
 * postgres.js のインスタンスをアプリ全体で 1 つだけ生成・共有し、内部の接続プールを
 * 使い回す。テストや明示的な接続管理のためにファクトリ関数も公開する。
 */

import postgres from 'postgres';

import { loadDbEnv } from './env.js';

export type Sql = postgres.Sql;

/** 接続文字列から postgres.js クライアントを生成する。 */
export function createDbClient(databaseUrl: string): Sql {
  return postgres(databaseUrl, {
    // 上流障害の早期検知と、ハングしたままの接続滞留を避けるための保守的な既定値。
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
    onnotice: () => {},
  });
}

let sharedClient: Sql | undefined;

/** アプリ全体で共有する単一の DB クライアントを返す（遅延初期化）。 */
export function getDbClient(): Sql {
  if (sharedClient === undefined) {
    sharedClient = createDbClient(loadDbEnv().databaseUrl);
  }
  return sharedClient;
}

/** 共有クライアントを終了し、参照を解放する。プロセス終了時やテストで用いる。 */
export async function closeDbClient(): Promise<void> {
  if (sharedClient !== undefined) {
    await sharedClient.end();
    sharedClient = undefined;
  }
}
