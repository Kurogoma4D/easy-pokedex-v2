/**
 * PokeAPI のレスポンス型。
 *
 * BFF が上流の PokeAPI から受け取る生レスポンスの形を表す。フロントエンドと共有できるよう、
 * Hono などサーバー専用の依存を含めずに型定義のみを切り出している。整形後の DTO は
 * 各エンドポイント実装（#5/#6/#7）でこれらを基に定義する。
 */

/** 多言語名。`language.name` は PokeAPI のロケールコード（例: `ja-Hrkt`, `ja`, `en`）。 */
export interface PokeApiName {
  readonly name: string;
  readonly language: PokeApiNamedResource;
}

/** 名前と URL のみを持つ参照。一覧や関連リソースへのリンクに用いられる。 */
export interface PokeApiNamedResource {
  readonly name: string;
  readonly url: string;
}

/** ページネーション付きリソース一覧（`/pokemon`, `/type` などの共通形）。 */
export interface PokeApiResourceList {
  readonly count: number;
  readonly next: string | null;
  readonly previous: string | null;
  readonly results: readonly PokeApiNamedResource[];
}

export interface PokeApiPokemonType {
  readonly slot: number;
  readonly type: PokeApiNamedResource;
}

export interface PokeApiPokemonStat {
  readonly base_stat: number;
  readonly effort: number;
  readonly stat: PokeApiNamedResource;
}

export interface PokeApiPokemonAbility {
  readonly is_hidden: boolean;
  readonly slot: number;
  readonly ability: PokeApiNamedResource;
}

export interface PokeApiPokemonSprites {
  readonly front_default: string | null;
  readonly front_shiny: string | null;
  readonly other?: {
    readonly 'official-artwork'?: {
      readonly front_default: string | null;
    };
  };
}

/** `/pokemon/{id|name}` のレスポンス。 */
export interface PokeApiPokemon {
  readonly id: number;
  readonly name: string;
  readonly height: number;
  readonly weight: number;
  readonly base_experience: number | null;
  readonly types: readonly PokeApiPokemonType[];
  readonly stats: readonly PokeApiPokemonStat[];
  readonly abilities: readonly PokeApiPokemonAbility[];
  readonly sprites: PokeApiPokemonSprites;
  readonly species: PokeApiNamedResource;
}

export interface PokeApiFlavorTextEntry {
  readonly flavor_text: string;
  readonly language: PokeApiNamedResource;
  readonly version: PokeApiNamedResource;
}

/** `/pokemon-species/{id|name}` のレスポンス。 */
export interface PokeApiPokemonSpecies {
  readonly id: number;
  readonly name: string;
  readonly names: readonly PokeApiName[];
  readonly flavor_text_entries: readonly PokeApiFlavorTextEntry[];
  readonly generation: PokeApiNamedResource;
  readonly evolution_chain: { readonly url: string };
  readonly is_legendary: boolean;
  readonly is_mythical: boolean;
}

export interface PokeApiEvolutionChainLink {
  readonly species: PokeApiNamedResource;
  readonly evolves_to: readonly PokeApiEvolutionChainLink[];
}

/**
 * BFF が整形して返す一覧 DTO（FR-1 / FR-5）。フロントエンドと共有するため、
 * 上流の生レスポンス（`PokeApi*`）とは別に「画面が必要とする形」だけを表す。
 */

/** 対応ロケール。フロントエンドの i18n と同じ集合を保つ。 */
export type PokedexLocale = 'ja' | 'en';

/** ロケール別の表示名。上流に該当ロケール名が無い場合は英語名へフォールバックする。 */
export interface LocalizedName {
  readonly ja: string;
  readonly en: string;
}

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

/** `/evolution-chain/{id}` のレスポンス。 */
export interface PokeApiEvolutionChain {
  readonly id: number;
  readonly chain: PokeApiEvolutionChainLink;
}

/** `/type/{id|name}` のレスポンス。 */
export interface PokeApiType {
  readonly id: number;
  readonly name: string;
  readonly names: readonly PokeApiName[];
  readonly pokemon: readonly {
    readonly slot: number;
    readonly pokemon: PokeApiNamedResource;
  }[];
}
