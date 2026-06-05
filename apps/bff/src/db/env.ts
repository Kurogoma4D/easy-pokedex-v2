/**
 * Postgres 接続情報とセッション秘密鍵を環境変数から解決する。
 *
 * 接続情報は `DATABASE_URL`（単一の接続文字列）を優先し、未設定時は
 * `POSTGRES_*` の個別変数から URL を組み立てる。これにより docker-compose の
 * サービス定義と単一の `DATABASE_URL` の双方を同じコードで扱える。
 */

export interface DbEnv {
  /** Postgres 接続文字列（postgres://user:pass@host:port/db）。 */
  readonly databaseUrl: string;
  /** セッション Cookie 署名・暗号化に用いる秘密鍵。 */
  readonly sessionSecret: string;
}

const DEFAULT_POSTGRES_HOST = 'localhost';
const DEFAULT_POSTGRES_PORT = '5432';

function readDatabaseUrl(source: NodeJS.ProcessEnv): string {
  const direct = source['DATABASE_URL']?.trim();
  if (direct !== undefined && direct.length > 0) {
    return direct;
  }

  const user = source['POSTGRES_USER']?.trim();
  const password = source['POSTGRES_PASSWORD']?.trim();
  const db = source['POSTGRES_DB']?.trim();
  if (user === undefined || user.length === 0) {
    throw new Error('DATABASE_URL or POSTGRES_USER must be set');
  }
  if (password === undefined || password.length === 0) {
    throw new Error('DATABASE_URL or POSTGRES_PASSWORD must be set');
  }
  if (db === undefined || db.length === 0) {
    throw new Error('DATABASE_URL or POSTGRES_DB must be set');
  }

  const host = source['POSTGRES_HOST']?.trim() ?? DEFAULT_POSTGRES_HOST;
  const port = source['POSTGRES_PORT']?.trim() ?? DEFAULT_POSTGRES_PORT;
  const auth = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
  return `postgres://${auth}@${host}:${port}/${db}`;
}

function readSessionSecret(source: NodeJS.ProcessEnv): string {
  const secret = source['SESSION_SECRET']?.trim();
  if (secret === undefined || secret.length === 0) {
    throw new Error('SESSION_SECRET must be set');
  }
  return secret;
}

/** 環境変数（既定では `process.env`）から DB 設定を解決する。不足時は例外を投げる。 */
export function loadDbEnv(source: NodeJS.ProcessEnv = process.env): DbEnv {
  return {
    databaseUrl: readDatabaseUrl(source),
    sessionSecret: readSessionSecret(source),
  };
}
