import { Locale } from './locale';

/**
 * UI 文言の辞書。全ロケールが同一のキー集合を持つことを型で強制する。
 * ja を基準にキーを定義し、他ロケールは `Record<MessageKey, string>` で同じキーを要求する。
 */
const ja = {
  'app.title': 'イージーポケモン図鑑',
  'nav.list': '一覧',
  'nav.detail': '詳細',
  'locale.label': '言語',
  'locale.ja': '日本語',
  'locale.en': 'English',
  'a11y.localeSwitch': '言語の切り替え',

  // 一覧画面（モックアップ）
  'list.title': 'ずかん',
  'list.count': '{count}ひき とうろくずみ',
  'list.empty': 'じょうけんに あう ポケモンが いません。',
  'list.loadingMore': 'よみこみちゅう…',
  'list.endOfList': 'ここまで',
  'list.error': 'ポケモンの よみこみに しっぱいしました。',
  'list.retry': 'もういちど',

  // 検索／フィルタ
  'search.title': 'けんさく',
  'search.nameLabel': 'なまえ',
  'search.namePlaceholder': 'なまえで さがす',
  'search.typeLabel': 'タイプ',
  'search.typeLimit': 'タイプは{count}つまで',
  'search.generationLabel': 'せだい',
  'search.generationAll': 'すべて',
  'search.reset': 'リセット',
  'search.resultSummary': '{count}けん ヒット',
  'search.searching': 'けんさくちゅう…',
  'search.error': 'けんさくに しっぱいしました。',

  // 詳細画面（モックアップ）
  'detail.height': 'たかさ',
  'detail.weight': 'おもさ',
  'detail.types': 'タイプ',
  'detail.stats': 'ステータス',
  'detail.statTotal': 'ごうけい',
  'detail.abilities': 'とくせい',
  'detail.abilityHidden': 'かくれとくせい',
  'detail.evolution': 'しんか',
  'detail.matchups': 'タイプ相性',
  'detail.matchups.weaknesses': 'こうかばつぐん',
  'detail.matchups.resistances': 'いまひとつ',
  'detail.matchups.immunities': 'こうかなし',
  'detail.matchups.empty': 'なし',
  'detail.back': 'いちらんへ',
  'detail.loading': 'よみこみちゅう…',
  'detail.error': 'ポケモンの よみこみに しっぱいしました。',
  'detail.notFound': 'その ポケモンは みつかりませんでした。',
  'detail.retry': 'もういちど',

  // ステータス名
  'stat.hp': 'HP',
  'stat.attack': 'こうげき',
  'stat.defense': 'ぼうぎょ',
  'stat.special-attack': 'とくこう',
  'stat.special-defense': 'とくぼう',
  'stat.speed': 'すばやさ',
} as const;

export type MessageKey = keyof typeof ja;

export type MessageDictionary = Record<MessageKey, string>;

const en: MessageDictionary = {
  'app.title': 'Easy Pokédex',
  'nav.list': 'List',
  'nav.detail': 'Detail',
  'locale.label': 'Language',
  'locale.ja': '日本語',
  'locale.en': 'English',
  'a11y.localeSwitch': 'Switch language',

  // List screen (mockup)
  'list.title': 'POKÉDEX',
  'list.count': '{count} registered',
  'list.empty': 'No Pokémon match these filters.',
  'list.loadingMore': 'Loading more…',
  'list.endOfList': 'End of list',
  'list.error': 'Failed to load Pokémon.',
  'list.retry': 'Retry',

  // Search / filter
  'search.title': 'SEARCH',
  'search.nameLabel': 'Name',
  'search.namePlaceholder': 'Search by name',
  'search.typeLabel': 'Type',
  'search.typeLimit': 'Up to {count} types',
  'search.generationLabel': 'Generation',
  'search.generationAll': 'All',
  'search.reset': 'Reset',
  'search.resultSummary': '{count} results',
  'search.searching': 'Searching…',
  'search.error': 'Search failed.',

  // Detail screen (mockup)
  'detail.height': 'Height',
  'detail.weight': 'Weight',
  'detail.types': 'Type',
  'detail.stats': 'Stats',
  'detail.statTotal': 'Total',
  'detail.abilities': 'Abilities',
  'detail.abilityHidden': 'Hidden',
  'detail.evolution': 'Evolution',
  'detail.matchups': 'Type matchups',
  'detail.matchups.weaknesses': 'Weak to',
  'detail.matchups.resistances': 'Resists',
  'detail.matchups.immunities': 'Immune to',
  'detail.matchups.empty': 'None',
  'detail.back': 'Back to list',
  'detail.loading': 'Loading…',
  'detail.error': 'Failed to load this Pokémon.',
  'detail.notFound': 'That Pokémon could not be found.',
  'detail.retry': 'Retry',

  // Stat names
  'stat.hp': 'HP',
  'stat.attack': 'Attack',
  'stat.defense': 'Defense',
  'stat.special-attack': 'Sp. Atk',
  'stat.special-defense': 'Sp. Def',
  'stat.speed': 'Speed',
};

export const MESSAGES: Record<Locale, MessageDictionary> = {
  ja,
  en,
};
