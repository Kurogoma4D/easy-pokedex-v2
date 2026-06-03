/** 対応ロケール。spec の対応言語（日本語・英語）に対応する。 */
export const LOCALES = ['ja', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'ja';

/** localStorage に選択ロケールを保存する際のキー。 */
export const LOCALE_STORAGE_KEY = 'easy-pokedex.locale';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}
