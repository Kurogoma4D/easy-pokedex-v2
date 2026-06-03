import { LocalizedName } from '../../i18n/localized-name';

/**
 * BFF の一覧 DTO（`apps/bff/src/pokeapi/types.ts` の `PokemonListItem` / `PokemonListResponse`）を
 * フロントエンド側でミラーした型。BFF とフロントは別パッケージのためソースは共有できないが、
 * 形を一致させることで `/pokemon/list` のレスポンスをそのまま型付きで扱える。
 */

/** 一覧 1 要素。図鑑番号・スプライト・多言語名・タイプを持つ（FR-1）。 */
export interface PokemonListItem {
  /** 図鑑番号（= PokeAPI の id）。 */
  readonly id: number;
  /** スプライト画像 URL。上流に画像が無い場合は null。 */
  readonly imageUrl: string | null;
  /** ja/en 両方の表示名。 */
  readonly name: LocalizedName;
  /** タイプ名（slot 昇順、英語のタイプ識別子）。 */
  readonly types: readonly string[];
}

/** 一覧エンドポイントのレスポンス。無限スクロール用にカーソル情報を含む。 */
export interface PokemonListResponse {
  /** 上流の総件数。 */
  readonly count: number;
  /** 今回返した範囲の先頭オフセット。 */
  readonly offset: number;
  /** 今回返した範囲の要求件数。 */
  readonly limit: number;
  /** 次ページの offset。これ以上無い場合は null。 */
  readonly nextOffset: number | null;
  readonly results: readonly PokemonListItem[];
}
