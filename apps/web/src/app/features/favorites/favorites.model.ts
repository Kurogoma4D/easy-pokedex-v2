/**
 * お気に入り API（`/favorites`）の応答型。BFF（`apps/bff/src/favorites/service.ts` の
 * `FavoriteItem` とルート応答）と同じ表現を frontend 側で再宣言する。
 * 認証は HttpOnly Cookie で運ばれるため、応答にトークン等は含まない。
 */

/** お気に入り 1 件。BFF の `FavoriteItem` に対応する。 */
export interface FavoriteItem {
  readonly pokemonId: number;
}

/** `GET /favorites` の成功応答。 */
export interface FavoritesListResponse {
  readonly favorites: readonly FavoriteItem[];
}
