import { LocalizedName } from '../../i18n/localized-name';

/**
 * BFF の詳細 DTO（`apps/bff/src/pokeapi/types.ts` の `PokemonDetail` ほか）を
 * フロントエンド側でミラーした型。BFF とフロントは別パッケージのためソースは共有できないが、
 * 形を一致させることで `/pokemon/:idOrName` のレスポンスをそのまま型付きで扱える。
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
export interface PokemonDetailResponse {
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
  /** 図鑑説明文（ja/en）。改行・制御文字を整形済み。該当ロケールが無ければ英語へフォールバックする。 */
  readonly flavorText: LocalizedName;
  /** 分類（例: ja「ねずみポケモン」/ en「Mouse Pokémon」）。該当ロケールが無ければ英語へフォールバックする。 */
  readonly genus: LocalizedName;
  /** 世代識別子（例: `generation-i`）。 */
  readonly generation: string;
  /** 伝説のポケモンか。 */
  readonly isLegendary: boolean;
  /** 幻のポケモンか。 */
  readonly isMythical: boolean;
  /** 鳴き声の音源 URL。上流に音源が無い場合は null。 */
  readonly cryUrl: string | null;
}
