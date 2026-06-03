import { LocalizedName } from '../../i18n/localized-name';

/**
 * 世代フィルタの選択肢（FR-2）。
 *
 * 世代は PokeAPI で固定の集合（`generation-i` 〜 `generation-ix`）であり頻繁に増えないため、
 * 世代一覧専用の BFF エンドポイントを設けず静的に持つ。識別子は BFF 検索（`generation` パラメータ）
 * がそのまま受け付ける PokeAPI の世代名で、`name` は i18n ロケールサービスで表示名へ解決する。
 */
export const GENERATIONS: readonly { readonly id: string; readonly name: LocalizedName }[] = [
  { id: 'generation-i', name: { ja: '第1世代', en: 'Generation I' } },
  { id: 'generation-ii', name: { ja: '第2世代', en: 'Generation II' } },
  { id: 'generation-iii', name: { ja: '第3世代', en: 'Generation III' } },
  { id: 'generation-iv', name: { ja: '第4世代', en: 'Generation IV' } },
  { id: 'generation-v', name: { ja: '第5世代', en: 'Generation V' } },
  { id: 'generation-vi', name: { ja: '第6世代', en: 'Generation VI' } },
  { id: 'generation-vii', name: { ja: '第7世代', en: 'Generation VII' } },
  { id: 'generation-viii', name: { ja: '第8世代', en: 'Generation VIII' } },
  { id: 'generation-ix', name: { ja: '第9世代', en: 'Generation IX' } },
];

/**
 * 同時に選択できるタイプの最大数。BFF はタイプを最大 5 件までしか受け付けず超過時に 400 を返すため、
 * UI 側でも選択を 5 件に制限して不正なリクエストを送らないようにする
 * （`apps/bff/src/routes/pokemon.ts` の `MAX_TYPE_PARAMS` と一致させる）。
 */
export const MAX_TYPE_SELECTION = 5;
