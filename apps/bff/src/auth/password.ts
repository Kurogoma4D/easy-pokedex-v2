/**
 * パスワードのハッシュ化・照合。
 *
 * Node 標準の `scrypt`（メモリハードな鍵導出関数）を用い、ネイティブ依存
 * （bcrypt/argon2 のビルド済みバイナリ）を追加せずに平文非保存を満たす。
 * 1 パスワードごとにランダムなソルトを生成し、`scrypt$N$r$p$salt$hash` 形式の
 * 自己記述的な文字列として保存する。これによりパラメータを将来変更しても
 * 既存ハッシュを同じ照合経路で扱える。
 *
 * 照合は `timingSafeEqual` で行い、長さ・内容の差によるタイミング差を避ける。
 */

import { randomBytes, scrypt, type ScryptOptions, timingSafeEqual } from 'node:crypto';

/** scrypt をオプション付きで Promise 化する。`promisify` は options 付きオーバーロードを保てないため手で包む。 */
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err !== null) {
        reject(err);
        return;
      }
      resolve(derivedKey);
    });
  });
}

/** scrypt のコストパラメータ。対話的ログインで許容できる範囲の保守的な既定値。 */
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

const ALGORITHM = 'scrypt';

/** 平文パスワードを保存用のハッシュ文字列へ変換する。 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scryptAsync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  const parts = [
    ALGORITHM,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64'),
    derived.toString('base64'),
  ];
  return parts.join('$');
}

/** 平文パスワードが保存済みハッシュと一致するか照合する。 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== ALGORITHM) {
    return false;
  }
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false;
  }

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], 'base64');
    expected = Buffer.from(parts[5], 'base64');
  } catch {
    return false;
  }

  const derived = await scryptAsync(password, salt, expected.length, {
    N: n,
    r,
    p,
  });

  if (derived.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(derived, expected);
}
