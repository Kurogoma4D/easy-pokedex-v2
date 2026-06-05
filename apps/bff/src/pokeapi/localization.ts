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
 * 図鑑説明文を読みやすく整形する。上流の説明文は固定幅で折り返すための改行（`\n`）や
 * 改ページ制御文字（`\f`、種名直後などに現れる）を含むため、これらと連続する空白を
 * 単一の半角スペースへ畳み、前後の空白を取り除く。
 */
export function formatFlavorText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** 指定ロケールコードに一致する最後（最新側）のエントリを返す。複数バージョンの代表選択に用いる。 */
function selectLatestByLanguage<T extends { readonly language: PokeApiName['language'] }>(
  entries: readonly T[],
  languageCodes: readonly string[],
): T | undefined {
  for (const code of languageCodes) {
    let hit: T | undefined;
    for (const entry of entries) {
      if (entry.language.name === code) {
        hit = entry;
      }
    }
    if (hit !== undefined) {
      return hit;
    }
  }
  return undefined;
}

/**
 * 図鑑説明文エントリから ja/en の表示文を組み立てる。各言語の代表（最新側）エントリを選び、
 * en は英語（無ければ `fallback`）、ja は ja-Hrkt/ja を採り、いずれも欠ければ en へフォールバックする。
 * 選んだ説明文は `formatFlavorText` で整形する。entries が未定義でも壊れない。
 */
export function buildLocalizedFlavorText(
  entries: readonly PokeApiFlavorTextEntry[] | undefined,
  fallback = '',
): LocalizedName {
  const list = entries ?? [];
  const enEntry = selectLatestByLanguage(list, ['en']);
  const en = enEntry !== undefined ? formatFlavorText(enEntry.flavor_text) : fallback;
  const jaEntry = selectLatestByLanguage(list, JA_LANGUAGE_CODES);
  const ja = jaEntry !== undefined ? formatFlavorText(jaEntry.flavor_text) : en;
  return { ja, en };
}

/**
 * 分類（genera）から ja/en の表示文を組み立てる。en は英語（無ければ `fallback`）、
 * ja は ja-Hrkt/ja を採り、いずれも欠ければ en へフォールバックする。genera が未定義でも壊れない。
 */
export function buildLocalizedGenus(
  genera: readonly PokeApiGenus[] | undefined,
  fallback = '',
): LocalizedName {
  const list = genera ?? [];
  const enEntry = selectLatestByLanguage(list, ['en']);
  const en = enEntry?.genus ?? fallback;
  const jaEntry = selectLatestByLanguage(list, JA_LANGUAGE_CODES);
  const ja = jaEntry?.genus ?? en;
  return { ja, en };
}

/** 上流スプライトから表示用の画像 URL を選ぶ。公式アートワークを優先し front_default へフォールバックする。 */
export function selectImageUrl(pokemon: PokeApiPokemon): string | null {
  return (
    pokemon.sprites.other?.['official-artwork']?.front_default ?? pokemon.sprites.front_default
  );
}

/**
 * 鳴き声の音源 URL を選ぶ。`cries.latest` を優先し、無ければ `cries.legacy`、
 * いずれも無ければ null を返す（音源欠落時はフロントが再生ボタンを無効化する）。
 */
export function selectCryUrl(pokemon: PokeApiPokemon): string | null {
  return pokemon.cries?.latest ?? pokemon.cries?.legacy ?? null;
}
