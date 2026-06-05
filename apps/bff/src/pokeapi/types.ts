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

/** 図鑑分類（例: ja「ねずみポケモン」/ en「Mouse Pokémon」）。`language.name` はロケールコード。 */
export interface PokeApiGenus {
  readonly genus: string;
  readonly language: PokeApiNamedResource;
}

/** `/pokemon-species/{id|name}` のレスポンス。 */
export interface PokeApiPokemonSpecies {
  readonly id: number;
  readonly name: string;
  readonly names: readonly PokeApiName[];
  readonly flavor_text_entries: readonly PokeApiFlavorTextEntry[];
  readonly genera: readonly PokeApiGenus[];
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

/**
 * `/type/{id|name}` の被ダメージ相性。攻撃側タイプの集合を倍率ごとに持つ。
 * このタイプを防御側として受けたときに、各攻撃タイプが与えるダメージ倍率を表す。
 */
export interface PokeApiTypeDamageRelations {
  /** このタイプに 2 倍ダメージを与える攻撃タイプ。 */
  readonly double_damage_from: readonly PokeApiNamedResource[];
  /** このタイプに 0.5 倍ダメージを与える攻撃タイプ。 */
  readonly half_damage_from: readonly PokeApiNamedResource[];
  /** このタイプに 0 倍（無効）の攻撃タイプ。 */
  readonly no_damage_from: readonly PokeApiNamedResource[];
}

/** `/type/{id|name}` のレスポンス。 */
export interface PokeApiType {
  readonly id: number;
  readonly name: string;
  readonly names: readonly PokeApiName[];
  readonly damage_relations: PokeApiTypeDamageRelations;
  readonly pokemon: readonly {
    readonly slot: number;
    readonly pokemon: PokeApiNamedResource;
  }[];
}

/** `/ability/{id|name}` のレスポンス。固有名詞の多言語化に names のみ用いる。 */
export interface PokeApiAbility {
  readonly id: number;
  readonly name: string;
  readonly names: readonly PokeApiName[];
}

/**
 * `/generation/{id|name}` のレスポンス。世代に属する種一覧（`pokemon_species`）を
 * メンバー集合として用い、世代フィルタの候補を上流の 1 リクエストで得る。
 */
export interface PokeApiGeneration {
  readonly id: number;
  readonly name: string;
  readonly pokemon_species: readonly PokeApiNamedResource[];
}

/**
 * BFF が整形して返す詳細 DTO（FR-3 / FR-4 / FR-5）。pokemon / species / evolution-chain と
 * type / ability の多言語名を集約し、画面が必要とする形だけを 1 レスポンスにまとめる。
 */

/** タイプ。`id` は英語のタイプ識別子（例: `grass`）、`name` は ja/en の表示名。 */
export interface PokemonTypeDetail {
  /** 英語のタイプ識別子（slot 昇順で並ぶ）。 */
  readonly id: string;
  /** ja/en の表示名。 */
  readonly name: LocalizedName;
}

/** 特性。`id` は英語の特性識別子、`name` は ja/en の表示名、`isHidden` は隠れ特性か。 */
export interface PokemonAbilityDetail {
  /** 英語の特性識別子。 */
  readonly id: string;
  /** ja/en の表示名。 */
  readonly name: LocalizedName;
  /** 隠れ特性かどうか。 */
  readonly isHidden: boolean;
}

/** ステータス。`id` は英語の識別子（例: `hp`, `attack`）、`base` は種族値。 */
export interface PokemonStatDetail {
  /** 英語のステータス識別子。 */
  readonly id: string;
  /** 種族値。 */
  readonly base: number;
}

/**
 * 進化チェーンのノード。進化は分岐しうるため `evolvesTo` は配列で、ツリー構造を保つ。
 * 各ノードは図鑑番号と ja/en の名前・画像を持ち、フロントが追加取得せず描画できる。
 */
export interface EvolutionNode {
  /** 図鑑番号（= PokeAPI の id）。 */
  readonly id: number;
  /** ja/en の表示名。 */
  readonly name: LocalizedName;
  /** スプライト画像 URL。上流に画像が無い場合は null。 */
  readonly imageUrl: string | null;
  /** この種から進化する次段。分岐があれば複数、無ければ空配列。 */
  readonly evolvesTo: readonly EvolutionNode[];
}

/** タイプ相性で参照される相手（攻撃側）タイプ。`id` は英語のタイプ識別子、`name` は ja/en の表示名。 */
export interface PokemonTypeMatchupType {
  /** 英語のタイプ識別子（例: `fire`）。 */
  readonly id: string;
  /** ja/en の表示名。 */
  readonly name: LocalizedName;
}

/** 同一倍率にまとまる相手タイプの集合。`multiplier` は被ダメージ倍率（例: 4 / 2 / 0.5 / 0.25 / 0）。 */
export interface PokemonTypeMatchupGroup {
  /** 被ダメージ倍率。 */
  readonly multiplier: number;
  /** この倍率になる相手（攻撃側）タイプ。 */
  readonly types: readonly PokemonTypeMatchupType[];
}

/**
 * 詳細対象ポケモンのタイプ構成から算出した被ダメージ相性。複合タイプは各タイプの倍率を
 * 掛け合わせた最終倍率で分類する。等倍（×1）は含めない。
 */
export interface PokemonTypeMatchups {
  /** こうかばつぐん（倍率 > 1）。倍率降順。 */
  readonly weaknesses: readonly PokemonTypeMatchupGroup[];
  /** いまひとつ（0 < 倍率 < 1）。倍率降順。 */
  readonly resistances: readonly PokemonTypeMatchupGroup[];
  /** こうかなし（倍率 = 0）。 */
  readonly immunities: readonly PokemonTypeMatchupGroup[];
}

/** 詳細エンドポイントのレスポンス。番号・名前・画像・タイプ・ステータス・特性・進化を 1 つに集約する。 */
export interface PokemonDetail {
  /** 図鑑番号（= PokeAPI の id）。 */
  readonly id: number;
  /** ja/en 両方の表示名。 */
  readonly name: LocalizedName;
  /** スプライト画像 URL。上流に画像が無い場合は null。 */
  readonly imageUrl: string | null;
  /** 身長（デシメートル単位の上流値そのまま）。 */
  readonly height: number;
  /** 体重（ヘクトグラム単位の上流値そのまま）。 */
  readonly weight: number;
  /** タイプ（slot 昇順、多言語名付き）。 */
  readonly types: readonly PokemonTypeDetail[];
  /** ステータス（上流の並び順を保持）。 */
  readonly stats: readonly PokemonStatDetail[];
  /** 特性（slot 昇順、多言語名付き）。 */
  readonly abilities: readonly PokemonAbilityDetail[];
  /** 進化チェーンの根。単一進化（進化なし）でも 1 ノードのツリーとして返す。 */
  readonly evolutionChain: EvolutionNode;
  /** タイプ構成から算出した被ダメージ相性（弱点/耐性/無効）。 */
  readonly typeMatchups: PokemonTypeMatchups;
  /** 図鑑説明文（flavor text）。選択言語の代表 1 件を ja/en で持つ。該当言語が無ければ英語へフォールバック。 */
  readonly flavorText: LocalizedName;
  /** 分類（genus、例: ja「ねずみポケモン」/ en「Mouse Pokémon」）。該当言語が無ければ英語へフォールバック。 */
  readonly genus: LocalizedName;
  /** 世代識別子（例: `generation-i`）。表示名はフロントで解決する。 */
  readonly generation: string;
  /** 伝説のポケモンか。 */
  readonly isLegendary: boolean;
  /** 幻のポケモンか。 */
  readonly isMythical: boolean;
}

/**
 * 検索・フィルタの条件（FR-2 / FR-5）。すべて任意で、指定されたものを AND で組み合わせる。
 * 検索はクライアントに一覧を渡して絞り込むのではなく BFF 側で完結させる（spec 10. Open Questions）。
 */
export interface PokemonSearchParams {
  /** 名前の部分一致クエリ。ja/en どちらの表記でもヒットさせる。空・未指定なら名前で絞り込まない。 */
  readonly name?: string;
  /** タイプ識別子（英語、例: `grass`）。複数指定時はすべてのタイプを持つものに絞る（AND）。 */
  readonly types?: readonly string[];
  /** 世代識別子（例: `generation-i`）。指定時はその世代の種に絞る。 */
  readonly generation?: string;
  /** 返却件数の上限。 */
  readonly limit: number;
  /** 絞り込み後の結果に対するオフセット。 */
  readonly offset: number;
}

/**
 * 検索エンドポイントのレスポンス。1 要素の形は一覧（`PokemonListItem`）と揃え、
 * フロントが一覧と検索で同じ描画を使えるようにする。ページネーションは絞り込み後の
 * 結果集合に対して行う。
 */
export interface PokemonSearchResponse {
  /** 絞り込み後の総件数（ページング前）。 */
  readonly count: number;
  /** 今回返した範囲の先頭オフセット。 */
  readonly offset: number;
  /** 今回返した範囲の要求件数。 */
  readonly limit: number;
  /** 次ページの offset。これ以上無い場合は null。 */
  readonly nextOffset: number | null;
  readonly results: readonly PokemonListItem[];
}
