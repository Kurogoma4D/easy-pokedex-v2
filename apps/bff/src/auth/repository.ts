/**
 * 認証で用いる永続化の抽象。
 *
 * ルート・サービス層は具体的な DB 実装ではなくこのインターフェースに依存する。
 * 本番は Postgres 実装（`pg-repository.ts`）、テストはインメモリ実装
 * （`memory-repository.ts`）を差し込み、DB を起動せずにロジックを検証できる。
 */

export interface UserRecord {
  readonly id: number;
  readonly email: string;
  readonly passwordHash: string;
}

export interface SessionRecord {
  readonly id: string;
  readonly userId: number;
  readonly expiresAt: Date;
}

/** メール一意制約違反を表す。重複登録の検知に用いる。 */
export class DuplicateEmailError extends Error {
  constructor() {
    super('email already registered');
    this.name = 'DuplicateEmailError';
  }
}

export interface AuthRepository {
  /**
   * ユーザーを作成する。メールの一意制約に違反した場合は `DuplicateEmailError` を投げる。
   * email は小文字正規化済みの値を渡す前提。
   */
  createUser(email: string, passwordHash: string): Promise<UserRecord>;

  /** メール（小文字正規化済み）でユーザーを引く。存在しなければ null。 */
  findUserByEmail(email: string): Promise<UserRecord | null>;

  /** セッションを作成する。 */
  createSession(id: string, userId: number, expiresAt: Date): Promise<void>;

  /** 有効期限切れを除いたセッションを引く。期限切れ・不在なら null。 */
  findValidSession(id: string, now: Date): Promise<SessionRecord | null>;

  /** id でユーザーを引く。存在しなければ null。 */
  findUserById(id: number): Promise<UserRecord | null>;

  /** セッションを削除する（ログアウト）。 */
  deleteSession(id: string): Promise<void>;
}
