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

  // 検索／フィルタ（モックアップ）
  'search.title': 'けんさく',
  'search.nameLabel': 'なまえ',
  'search.namePlaceholder': 'なまえで さがす',
  'search.typeLabel': 'タイプ',
  'search.generationLabel': 'せだい',
  'search.generationAll': 'すべて',
  'search.reset': 'リセット',
  'search.resultSummary': '{count}けん ヒット',

  // 詳細画面（モックアップ）
  'detail.height': 'たかさ',
  'detail.weight': 'おもさ',
  'detail.types': 'タイプ',
  'detail.stats': 'ステータス',
  'detail.statTotal': 'ごうけい',
  'detail.abilities': 'とくせい',
  'detail.abilityHidden': 'かくれとくせい',
  'detail.evolution': 'しんか',
  'detail.flavor': 'ずかんせつめい',
  'detail.back': 'いちらんへ',

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

  // Search / filter (mockup)
  'search.title': 'SEARCH',
  'search.nameLabel': 'Name',
  'search.namePlaceholder': 'Search by name',
  'search.typeLabel': 'Type',
  'search.generationLabel': 'Generation',
  'search.generationAll': 'All',
  'search.reset': 'Reset',
  'search.resultSummary': '{count} results',

  // Detail screen (mockup)
  'detail.height': 'Height',
  'detail.weight': 'Weight',
  'detail.types': 'Type',
  'detail.stats': 'Stats',
  'detail.statTotal': 'Total',
  'detail.abilities': 'Abilities',
  'detail.abilityHidden': 'Hidden',
  'detail.evolution': 'Evolution',
  'detail.flavor': 'Pokédex entry',
  'detail.back': 'Back to list',

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
