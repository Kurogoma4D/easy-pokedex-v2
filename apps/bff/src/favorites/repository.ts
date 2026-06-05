/**
 * お気に入りで用いる永続化の抽象。
 *
 * ルート・サービス層は具体的な DB 実装ではなくこのインターフェースに依存する。
 * 本番は Postgres 実装（`pg-repository.ts`）、テストはインメモリ実装
 * （`memory-repository.ts`）を差し込み、DB を起動せずにロジックを検証できる。
 */

export interface FavoriteRecord {
  readonly pokemonId: number;
  readonly createdAt: Date;
}

export interface FavoriteRepository {
  /**
   * お気に入りを登録する。既に登録済みの場合は何もしない（冪等）。
   * (user_id, pokemon_id) の主キー制約により重複行は作られない。
   */
  add(userId: number, pokemonId: number): Promise<void>;

  /** お気に入りを解除する。未登録でもエラーにしない（冪等）。 */
  remove(userId: number, pokemonId: number): Promise<void>;

  /** ユーザーのお気に入り一覧を登録日時の新しい順で返す。 */
  list(userId: number): Promise<FavoriteRecord[]>;
}
