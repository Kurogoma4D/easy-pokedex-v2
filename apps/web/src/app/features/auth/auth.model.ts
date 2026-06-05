/**
 * 認証 API（`/auth/*`）の要求・応答型。BFF（`apps/bff/src/auth/service.ts` の
 * `AuthenticatedUser` / ルート応答）と同じ表現を frontend 側で再宣言する。
 * 認証セッションは HttpOnly Cookie で運ばれるため、応答にはトークン等を含まない。
 */

/** ログイン中ユーザー。BFF の `AuthenticatedUser` に対応する。 */
export interface AuthUser {
  readonly id: number;
  readonly email: string;
}

/** 登録・ログインの送信内容。 */
export interface Credentials {
  readonly email: string;
  readonly password: string;
}

/** `/auth/register` `/auth/login` `/auth/me` の成功応答。 */
export interface AuthUserResponse {
  readonly user: AuthUser;
}

/** バリデーション失敗時のフィールド単位エラー。BFF の `FieldError` に対応する。 */
export interface AuthFieldError {
  readonly field: 'email' | 'password';
  readonly message: string;
}

/** 400/401/409 などのエラー応答本文。 */
export interface AuthErrorResponse {
  readonly error: string;
  readonly details?: readonly AuthFieldError[];
}
