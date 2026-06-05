/** 認証入力のバリデーション。メール形式・パスワード長を検査する。 */

/** パスワードの最小・最大長。最小は短すぎる総当たり容易なものを弾く下限。 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** メールアドレスの簡易形式。ローカル部・@・ドメイン・TLD を要求する実用上の下限チェック。 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** メールの最大長。極端に長い入力を弾く（RFC 上限に合わせた実用値）。 */
const EMAIL_MAX_LENGTH = 254;

export interface CredentialsInput {
  readonly email?: unknown;
  readonly password?: unknown;
}

export interface ValidCredentials {
  readonly email: string;
  readonly password: string;
}

export type ValidationError = 'invalid_email' | 'invalid_password' | 'invalid_body';

/**
 * 登録・ログインの入力を検証し、正規化したメール（trim + lowercase）と生パスワードを返す。
 * 形式不正は `ValidationError` を返す。
 */
export function validateCredentials(
  input: CredentialsInput,
): { ok: true; value: ValidCredentials } | { ok: false; error: ValidationError } {
  const { email, password } = input;
  if (typeof email !== 'string' || typeof password !== 'string') {
    return { ok: false, error: 'invalid_body' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.length === 0 || normalizedEmail.length > EMAIL_MAX_LENGTH) {
    return { ok: false, error: 'invalid_email' };
  }
  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return { ok: false, error: 'invalid_email' };
  }

  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return { ok: false, error: 'invalid_password' };
  }

  return { ok: true, value: { email: normalizedEmail, password } };
}
