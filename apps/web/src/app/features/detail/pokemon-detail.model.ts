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

/** タイプ相性に現れる攻撃側タイプ 1 件。`id` は英語のタイプ識別子、`name` は ja/en の表示名。 */
export interface PokemonTypeMatchupType {
  /** 攻撃側タイプの英語識別子（例: `fire`）。 */
  readonly id: string;
  /** ja/en の表示名。 */
  readonly name: LocalizedName;
}

/** 被ダメージ倍率ごとに分類した攻撃側タイプの集合。 */
export interface PokemonTypeMatchupGroup {
  /** 被ダメージ倍率（例: 4, 2, 0.5, 0.25, 0）。 */
  readonly multiplier: number;
  /** この倍率になる攻撃側タイプ（タイプ識別子の昇順）。 */
  readonly types: readonly PokemonTypeMatchupType[];
}

/** タイプ相性。弱点（倍率 > 1）・耐性（0 < 倍率 < 1）・無効（倍率 = 0）。 */
export interface PokemonTypeMatchups {
  /** 倍率が 1 より大きいグループ（弱点）。倍率の降順。 */
  readonly weaknesses: readonly PokemonTypeMatchupGroup[];
  /** 倍率が 0 より大きく 1 未満のグループ（耐性）。倍率の降順。 */
  readonly resistances: readonly PokemonTypeMatchupGroup[];
  /** 倍率が 0 のグループ（無効）。 */
  readonly immunities: readonly PokemonTypeMatchupGroup[];
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
  /** タイプ構成から算出した被ダメージ相性（弱点 / 耐性 / 無効）。 */
  readonly typeMatchups: PokemonTypeMatchups;
  /** ステータス（上流の並び順を保持）。 */
  readonly stats: readonly PokemonStatDetail[];
  /** 特性（slot 昇順、多言語名付き）。 */
  readonly abilities: readonly PokemonAbilityDetail[];
  /** 進化チェーンの根。単一進化（進化なし）でも 1 ノードのツリーとして返す。 */
  readonly evolutionChain: EvolutionNode;
}
