import { Locale } from './locale';

/**
 * PokeAPI 由来の固有名詞（ポケモン名・タイプ名など）の多言語表記。
 * 一覧・詳細などの機能側が BFF レスポンスをこの形に整形して保持し、
 * `LocaleService.localizeName` で選択ロケールの表記へ解決する前提のインターフェース。
 */
export type LocalizedName = Partial<Record<Locale, string>>;

/**
 * `LocalizedName` から指定ロケールの表記を解決する。
 * 該当ロケールが無い場合はフォールバックロケール、いずれも無い場合は最初に見つかった値を返す。
 */
export function resolveLocalizedName(
  name: LocalizedName,
  locale: Locale,
  fallbackLocale: Locale,
): string {
  return name[locale] ?? name[fallbackLocale] ?? firstValue(name) ?? '';
}

function firstValue(name: LocalizedName): string | undefined {
  for (const key of Object.keys(name) as Locale[]) {
    const value = name[key];
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}
