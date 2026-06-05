/**
 * 認証・お気に入りの永続化インターフェース。ルート/サービス層はこの抽象にのみ依存し、
 * 実体は Postgres 実装（`pg-repository.ts`）か、テスト用のインメモリ実装で差し替える。
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

export interface AuthRepository {
  /** メールでユーザーを引く。存在しなければ null。 */
  findUserByEmail(email: string): Promise<UserRecord | null>;
  /** id でユーザーを引く。存在しなければ null。 */
  findUserById(id: number): Promise<UserRecord | null>;
  /**
   * ユーザーを作成する。メール重複（UNIQUE 制約違反）時は null を返し、呼び出し側で 409 にする。
   */
  createUser(email: string, passwordHash: string): Promise<UserRecord | null>;
  /** セッションを作成する。 */
  createSession(id: string, userId: number, expiresAt: Date): Promise<void>;
  /** セッションを引く。期限切れ・不存在は null。 */
  findSession(id: string): Promise<SessionRecord | null>;
  /** セッションを破棄する。 */
  deleteSession(id: string): Promise<void>;
}

export interface FavoriteRecord {
  readonly pokemonId: number;
  readonly createdAt: Date;
}

export interface FavoriteRepository {
  /** お気に入りを追加する（既存なら冪等に無視）。 */
  addFavorite(userId: number, pokemonId: number): Promise<void>;
  /** お気に入りを解除する。 */
  removeFavorite(userId: number, pokemonId: number): Promise<void>;
  /** ユーザーのお気に入り pokemon_id を新しい順に返す。 */
  listFavorites(userId: number): Promise<readonly FavoriteRecord[]>;
}
