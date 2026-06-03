import type { LocalizedName, PokeApiName, PokeApiPokemon } from './types.js';

/** PokeAPI のロケールコード。`ja-Hrkt`（ひらがな・カタカナ）を優先し、無ければ `ja` を使う。 */
export const JA_LANGUAGE_CODES = ['ja-Hrkt', 'ja'] as const;

/** 多言語名配列から指定ロケールコードに一致する名前を返す。複数候補は先頭一致を採る。 */
export function findLocalizedName(
  names: readonly PokeApiName[],
  languageCodes: readonly string[],
): string | undefined {
  for (const code of languageCodes) {
    const hit = names.find((entry) => entry.language.name === code);
    if (hit !== undefined) {
      return hit.name;
    }
  }
  return undefined;
}

/**
 * 多言語名配列から ja/en の表示名を組み立てる。en は英語名（無ければ `fallback`）、
 * ja は ja-Hrkt/ja を採り、いずれも欠ければ en へフォールバックする（名前が空にならないことを保証する）。
 */
export function buildLocalizedName(names: readonly PokeApiName[], fallback: string): LocalizedName {
  const en = findLocalizedName(names, ['en']) ?? fallback;
  const ja = findLocalizedName(names, JA_LANGUAGE_CODES) ?? en;
  return { ja, en };
}

/** 上流スプライトから表示用の画像 URL を選ぶ。公式アートワークを優先し front_default へフォールバックする。 */
export function selectImageUrl(pokemon: PokeApiPokemon): string | null {
  return (
    pokemon.sprites.other?.['official-artwork']?.front_default ?? pokemon.sprites.front_default
  );
}
