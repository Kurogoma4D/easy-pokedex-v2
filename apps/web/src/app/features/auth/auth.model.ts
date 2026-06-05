/** 認証済みユーザーの公開情報。BFF の `/auth` レスポンス（`user`）をミラーする。 */
export interface AuthUser {
  readonly id: number;
  readonly email: string;
}

/** 認証 API のエラー種別。UI 文言の出し分けに使う。 */
export type AuthErrorKind = 'invalid_input' | 'invalid_credentials' | 'email_taken' | 'network';
