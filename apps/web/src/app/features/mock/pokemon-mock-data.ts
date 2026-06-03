/**
 * モックアップ用の静的データ（DA-2）。
 *
 * BFF の DTO（`PokemonListItem` / `PokemonDetail` 等）と同じ形を再現し、機能 Issue（#11/#12/#13）が
 * ライブ取得に差し替えても描画コードがそのまま使えるようにする。ここでは画面の見た目を確定させる
 * ことが目的のため、ネットワーク取得は行わず代表的な値を直接持つ。
 */

import { LocalizedName } from '../../i18n/localized-name';

/** タイプ識別子（英語）。`tokens.css` の `--type-*` と一致する 18 種。 */
export type TypeId =
  | 'normal'
  | 'fire'
  | 'water'
  | 'grass'
  | 'electric'
  | 'ice'
  | 'fighting'
  | 'poison'
  | 'ground'
  | 'flying'
  | 'psychic'
  | 'bug'
  | 'rock'
  | 'ghost'
  | 'dragon'
  | 'dark'
  | 'steel'
  | 'fairy';

/** モック一覧 1 要素。BFF の `PokemonListItem` と同じ形。 */
export interface MockListItem {
  readonly id: number;
  readonly imageUrl: string | null;
  readonly name: LocalizedName;
  readonly types: readonly TypeId[];
}

/** モック種族値。BFF の `PokemonStatDetail` と同じ形。 */
export interface MockStat {
  readonly id: 'hp' | 'attack' | 'defense' | 'special-attack' | 'special-defense' | 'speed';
  readonly base: number;
}

/** モック特性。BFF の `PokemonAbilityDetail` と同じ形。 */
export interface MockAbility {
  readonly id: string;
  readonly name: LocalizedName;
  readonly isHidden: boolean;
}

/** モック進化ノード。BFF の `EvolutionNode` と同じ形（分岐に備えてツリー）。 */
export interface MockEvolutionNode {
  readonly id: number;
  readonly name: LocalizedName;
  readonly imageUrl: string | null;
  readonly evolvesTo: readonly MockEvolutionNode[];
}

/** モック詳細。BFF の `PokemonDetail` と同じ形。 */
export interface MockDetail {
  readonly id: number;
  readonly name: LocalizedName;
  readonly imageUrl: string | null;
  /** 身長（デシメートル単位の上流値そのまま）。 */
  readonly height: number;
  /** 体重（ヘクトグラム単位の上流値そのまま）。 */
  readonly weight: number;
  readonly types: readonly TypeId[];
  readonly stats: readonly MockStat[];
  readonly abilities: readonly MockAbility[];
  readonly flavorText: LocalizedName;
  readonly evolutionChain: MockEvolutionNode;
}

/** 公式アートワークの URL を図鑑番号から組み立てる（PokeAPI のスプライト配置に合わせる）。 */
function artwork(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}

/** 一覧モック。代表的な初代ポケモンを並べ、グリッド／無限スクロールの見え方を確認できる量を持つ。 */
export const MOCK_LIST: readonly MockListItem[] = [
  {
    id: 1,
    imageUrl: artwork(1),
    name: { ja: 'フシギダネ', en: 'Bulbasaur' },
    types: ['grass', 'poison'],
  },
  { id: 4, imageUrl: artwork(4), name: { ja: 'ヒトカゲ', en: 'Charmander' }, types: ['fire'] },
  { id: 7, imageUrl: artwork(7), name: { ja: 'ゼニガメ', en: 'Squirtle' }, types: ['water'] },
  { id: 25, imageUrl: artwork(25), name: { ja: 'ピカチュウ', en: 'Pikachu' }, types: ['electric'] },
  {
    id: 39,
    imageUrl: artwork(39),
    name: { ja: 'プリン', en: 'Jigglypuff' },
    types: ['normal', 'fairy'],
  },
  { id: 52, imageUrl: artwork(52), name: { ja: 'ニャース', en: 'Meowth' }, types: ['normal'] },
  { id: 63, imageUrl: artwork(63), name: { ja: 'ケーシィ', en: 'Abra' }, types: ['psychic'] },
  {
    id: 74,
    imageUrl: artwork(74),
    name: { ja: 'イシツブテ', en: 'Geodude' },
    types: ['rock', 'ground'],
  },
  {
    id: 92,
    imageUrl: artwork(92),
    name: { ja: 'ゴース', en: 'Gastly' },
    types: ['ghost', 'poison'],
  },
  {
    id: 95,
    imageUrl: artwork(95),
    name: { ja: 'イワーク', en: 'Onix' },
    types: ['rock', 'ground'],
  },
  {
    id: 123,
    imageUrl: artwork(123),
    name: { ja: 'ストライク', en: 'Scyther' },
    types: ['bug', 'flying'],
  },
  {
    id: 130,
    imageUrl: artwork(130),
    name: { ja: 'ギャラドス', en: 'Gyarados' },
    types: ['water', 'flying'],
  },
  {
    id: 131,
    imageUrl: artwork(131),
    name: { ja: 'ラプラス', en: 'Lapras' },
    types: ['water', 'ice'],
  },
  { id: 143, imageUrl: artwork(143), name: { ja: 'カビゴン', en: 'Snorlax' }, types: ['normal'] },
  {
    id: 149,
    imageUrl: artwork(149),
    name: { ja: 'カイリュー', en: 'Dragonite' },
    types: ['dragon', 'flying'],
  },
  { id: 150, imageUrl: artwork(150), name: { ja: 'ミュウツー', en: 'Mewtwo' }, types: ['psychic'] },
];

/** 詳細モック（フシギダネ）。ステータス・特性・分岐なしの 3 段進化を含む。 */
export const MOCK_DETAIL: MockDetail = {
  id: 1,
  name: { ja: 'フシギダネ', en: 'Bulbasaur' },
  imageUrl: artwork(1),
  height: 7,
  weight: 69,
  types: ['grass', 'poison'],
  stats: [
    { id: 'hp', base: 45 },
    { id: 'attack', base: 49 },
    { id: 'defense', base: 49 },
    { id: 'special-attack', base: 65 },
    { id: 'special-defense', base: 65 },
    { id: 'speed', base: 45 },
  ],
  abilities: [
    { id: 'overgrow', name: { ja: 'しんりょく', en: 'Overgrow' }, isHidden: false },
    { id: 'chlorophyll', name: { ja: 'ようりょくそ', en: 'Chlorophyll' }, isHidden: true },
  ],
  flavorText: {
    ja: 'うまれたときから せなかに しょくぶつの タネが あって すこしずつ おおきく そだつ。',
    en: 'A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.',
  },
  evolutionChain: {
    id: 1,
    name: { ja: 'フシギダネ', en: 'Bulbasaur' },
    imageUrl: artwork(1),
    evolvesTo: [
      {
        id: 2,
        name: { ja: 'フシギソウ', en: 'Ivysaur' },
        imageUrl: artwork(2),
        evolvesTo: [
          {
            id: 3,
            name: { ja: 'フシギバナ', en: 'Venusaur' },
            imageUrl: artwork(3),
            evolvesTo: [],
          },
        ],
      },
    ],
  },
};

/** タイプフィルタの候補。識別子と ja/en 表示名。 */
export const MOCK_TYPES: readonly { readonly id: TypeId; readonly name: LocalizedName }[] = [
  { id: 'normal', name: { ja: 'ノーマル', en: 'Normal' } },
  { id: 'fire', name: { ja: 'ほのお', en: 'Fire' } },
  { id: 'water', name: { ja: 'みず', en: 'Water' } },
  { id: 'grass', name: { ja: 'くさ', en: 'Grass' } },
  { id: 'electric', name: { ja: 'でんき', en: 'Electric' } },
  { id: 'ice', name: { ja: 'こおり', en: 'Ice' } },
  { id: 'fighting', name: { ja: 'かくとう', en: 'Fighting' } },
  { id: 'poison', name: { ja: 'どく', en: 'Poison' } },
  { id: 'ground', name: { ja: 'じめん', en: 'Ground' } },
  { id: 'flying', name: { ja: 'ひこう', en: 'Flying' } },
  { id: 'psychic', name: { ja: 'エスパー', en: 'Psychic' } },
  { id: 'bug', name: { ja: 'むし', en: 'Bug' } },
  { id: 'rock', name: { ja: 'いわ', en: 'Rock' } },
  { id: 'ghost', name: { ja: 'ゴースト', en: 'Ghost' } },
  { id: 'dragon', name: { ja: 'ドラゴン', en: 'Dragon' } },
  { id: 'dark', name: { ja: 'あく', en: 'Dark' } },
  { id: 'steel', name: { ja: 'はがね', en: 'Steel' } },
  { id: 'fairy', name: { ja: 'フェアリー', en: 'Fairy' } },
];

/** 世代フィルタの候補。識別子と ja/en 表示名。 */
export const MOCK_GENERATIONS: readonly { readonly id: string; readonly name: LocalizedName }[] = [
  { id: 'generation-i', name: { ja: '第1世代', en: 'Generation I' } },
  { id: 'generation-ii', name: { ja: '第2世代', en: 'Generation II' } },
  { id: 'generation-iii', name: { ja: '第3世代', en: 'Generation III' } },
  { id: 'generation-iv', name: { ja: '第4世代', en: 'Generation IV' } },
  { id: 'generation-v', name: { ja: '第5世代', en: 'Generation V' } },
];
