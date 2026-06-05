/**
 * アカウント登録・ログイン入力のバリデーション。
 *
 * 検証はルートではなくこのモジュールに集約し、登録・ログインで共通の規則
 * （メール形式・パスワード長）を一箇所で管理する。フィールド単位のエラーを
 * 返すことで、ルート側は HTTP レスポンスへの写像だけに専念できる。
 */

/** パスワードの最小長。これ未満は登録・ログインともに拒否する。 */
export const PASSWORD_MIN_LENGTH = 8;
/** パスワードの最大長。bcrypt 系の入力上限や DoS 回避のため十分大きい値で頭打ちにする。 */
export const PASSWORD_MAX_LENGTH = 128;

/**
 * メール形式の検証パターン。RFC を厳密に満たすことより、空白・複数 @・ドメイン欠落など
 * 明らかな不正を弾くことを目的とする。最終的な一意性・到達性は DB 制約と運用に委ねる。
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CredentialsInput {
  readonly email: unknown;
  readonly password: unknown;
}

export interface ValidCredentials {
  /** 正規化済みメール（前後空白除去・小文字化）。一意性は lower(email) で判定するため小文字で持つ。 */
  readonly email: string;
  readonly password: string;
}

export interface FieldError {
  readonly field: 'email' | 'password';
  readonly message: string;
}

export type ValidationResult =
  | { readonly ok: true; readonly value: ValidCredentials }
  | { readonly ok: false; readonly errors: FieldError[] };

/** メールアドレスを検証し、正規化済みの値を返す。 */
function validateEmail(raw: unknown): { value?: string; error?: FieldError } {
  if (typeof raw !== 'string') {
    return { error: { field: 'email', message: 'email is required' } };
  }
  const email = raw.trim().toLowerCase();
  if (email.length === 0) {
    return { error: { field: 'email', message: 'email is required' } };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { error: { field: 'email', message: 'email format is invalid' } };
  }
  return { value: email };
}

/** パスワードを検証する。長さ規則のみを課し、内容（複雑性）は要求しない。 */
function validatePassword(raw: unknown): { value?: string; error?: FieldError } {
  if (typeof raw !== 'string') {
    return { error: { field: 'password', message: 'password is required' } };
  }
  if (raw.length < PASSWORD_MIN_LENGTH) {
    return {
      error: {
        field: 'password',
        message: `password must be at least ${PASSWORD_MIN_LENGTH} characters`,
      },
    };
  }
  if (raw.length > PASSWORD_MAX_LENGTH) {
    return {
      error: {
        field: 'password',
        message: `password must be at most ${PASSWORD_MAX_LENGTH} characters`,
      },
    };
  }
  return { value: raw };
}

/** 登録・ログイン共通の資格情報を検証する。複数フィールドのエラーをまとめて返す。 */
export function validateCredentials(input: CredentialsInput): ValidationResult {
  const errors: FieldError[] = [];

  const email = validateEmail(input.email);
  if (email.error !== undefined) {
    errors.push(email.error);
  }

  const password = validatePassword(input.password);
  if (password.error !== undefined) {
    errors.push(password.error);
  }

  if (errors.length > 0 || email.value === undefined || password.value === undefined) {
    return { ok: false, errors };
  }
  return { ok: true, value: { email: email.value, password: password.value } };
}
