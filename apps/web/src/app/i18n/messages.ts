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
  'list.placeholder': 'ポケモン一覧（準備中）',
  'detail.placeholder': 'ポケモン詳細（準備中）',
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
  'list.placeholder': 'Pokémon list (coming soon)',
  'detail.placeholder': 'Pokémon detail (coming soon)',
};

export const MESSAGES: Record<Locale, MessageDictionary> = {
  ja,
  en,
};
