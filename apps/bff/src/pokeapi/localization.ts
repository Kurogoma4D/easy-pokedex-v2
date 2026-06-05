import type {
  LocalizedName,
  PokeApiFlavorTextEntry,
  PokeApiGenus,
  PokeApiName,
  PokeApiPokemon,
} from './types.js';

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

/**
 * 図鑑説明文（flavor text）の改行・制御文字を読みやすく整える。
 * 上流は語の途中で `\n`（改行）や `\f`（フィード、世代により語間に挿入される）を含むため、
 * これらと連続空白を半角スペース 1 つへ畳み込み、前後の空白を除く。
 */
export function formatFlavorText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * 指定ロケールの flavor text を 1 件選ぶ。複数バージョン分のエントリがあるため、
 * 該当言語の「最後」のエントリ（=最も新しいバージョン側）を代表として採る。
 */
function selectFlavorText(
  entries: readonly PokeApiFlavorTextEntry[] | undefined,
  languageCodes: readonly string[],
): string | undefined {
  if (entries === undefined) {
    return undefined;
  }
  for (const code of languageCodes) {
    const matches = entries.filter((entry) => entry.language.name === code);
    const last = matches[matches.length - 1];
    if (last !== undefined) {
      return formatFlavorText(last.flavor_text);
    }
  }
  return undefined;
}

/**
 * flavor text エントリ群から ja/en の表示用説明文を組み立てる。en は英語の代表 1 件、
 * ja は ja-Hrkt/ja の代表 1 件を採り、いずれも欠ければ en へフォールバックする
 * （`fallback` は en も無い場合の最終フォールバック）。
 */
export function buildLocalizedFlavorText(
  entries: readonly PokeApiFlavorTextEntry[] | undefined,
  fallback = '',
): LocalizedName {
  const en = selectFlavorText(entries, ['en']) ?? fallback;
  const ja = selectFlavorText(entries, JA_LANGUAGE_CODES) ?? en;
  return { ja, en };
}

/** genera 配列から指定ロケールの分類名を返す。複数候補は先頭一致を採る。 */
function findGenus(
  genera: readonly PokeApiGenus[] | undefined,
  languageCodes: readonly string[],
): string | undefined {
  if (genera === undefined) {
    return undefined;
  }
  for (const code of languageCodes) {
    const hit = genera.find((entry) => entry.language.name === code);
    if (hit !== undefined) {
      return hit.genus;
    }
  }
  return undefined;
}

/**
 * genera 配列から ja/en の分類名を組み立てる。en は英語名、ja は ja-Hrkt/ja を採り、
 * いずれも欠ければ en（さらに無ければ `fallback`）へフォールバックする。
 */
export function buildLocalizedGenus(
  genera: readonly PokeApiGenus[] | undefined,
  fallback = '',
): LocalizedName {
  const en = findGenus(genera, ['en']) ?? fallback;
  const ja = findGenus(genera, JA_LANGUAGE_CODES) ?? en;
  return { ja, en };
}

/** 上流スプライトから表示用の画像 URL を選ぶ。公式アートワークを優先し front_default へフォールバックする。 */
export function selectImageUrl(pokemon: PokeApiPokemon): string | null {
  return (
    pokemon.sprites.other?.['official-artwork']?.front_default ?? pokemon.sprites.front_default
  );
}
