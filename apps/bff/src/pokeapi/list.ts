import type { PokeApiClient, RequestOptions } from './client.js';
import type {
  LocalizedName,
  PokeApiName,
  PokeApiPokemon,
  PokeApiPokemonSpecies,
  PokemonListItem,
  PokemonListResponse,
} from './types.js';

/** PokeAPI のロケールコード。`ja-Hrkt`（ひらがな・カタカナ）を優先し、無ければ `ja` を使う。 */
const JA_LANGUAGE_CODES = ['ja-Hrkt', 'ja'] as const;

/**
 * `/pokemon/{id}/` 形式のリソース URL から数値 id を取り出す。
 * 一覧レスポンスの各要素は name+url のみのため、後続の個別取得に id が要る。
 */
export function extractIdFromResourceUrl(url: string): number {
  const match = /\/(\d+)\/?$/.exec(url);
  if (match === null) {
    throw new Error(`Could not extract id from PokeAPI resource URL: ${url}`);
  }
  return Number(match[1]);
}

/** 上流スプライトから一覧表示用の画像 URL を選ぶ。公式アートワークを優先し front_default へフォールバックする。 */
function selectImageUrl(pokemon: PokeApiPokemon): string | null {
  return (
    pokemon.sprites.other?.['official-artwork']?.front_default ?? pokemon.sprites.front_default
  );
}

/** 多言語名配列から指定ロケールコードに一致する名前を返す。複数候補は先頭一致を採る。 */
function findLocalizedName(
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
 * 表示名を組み立てる。en は species の英語名（無ければ pokemon.name）を、ja は ja-Hrkt/ja を採り、
 * いずれも欠ける場合は en にフォールバックする（名前が空にならないことを保証する）。
 */
function buildLocalizedName(
  pokemon: PokeApiPokemon,
  species: PokeApiPokemonSpecies,
): LocalizedName {
  const en = findLocalizedName(species.names, ['en']) ?? pokemon.name;
  const ja = findLocalizedName(species.names, JA_LANGUAGE_CODES) ?? en;
  return { ja, en };
}

function toListItem(pokemon: PokeApiPokemon, species: PokeApiPokemonSpecies): PokemonListItem {
  const types = [...pokemon.types].sort((a, b) => a.slot - b.slot).map((entry) => entry.type.name);

  return {
    id: pokemon.id,
    imageUrl: selectImageUrl(pokemon),
    name: buildLocalizedName(pokemon, species),
    types,
  };
}

export interface FetchPokemonListParams {
  readonly limit: number;
  readonly offset: number;
}

/**
 * 無限スクロール用の一覧を整形して返す（FR-1）。
 *
 * `/pokemon` の一覧（name+url のみ）を起点に、各要素のタイプ・スプライトを `/pokemon/{id}`、
 * 多言語名を `/pokemon-species/{id}` から取得して 1 要素にまとめる。上流アクセスはすべて
 * 注入された PokeApiClient（キャッシュ・単一フライト込み）経由で行い、直接 fetch しない。
 */
export async function fetchPokemonList(
  client: PokeApiClient,
  params: FetchPokemonListParams,
  options?: RequestOptions,
): Promise<PokemonListResponse> {
  const list = await client.fetchPokemonList(params, options);

  const results = await Promise.all(
    list.results.map(async (resource): Promise<PokemonListItem> => {
      const id = extractIdFromResourceUrl(resource.url);
      const [pokemon, species] = await Promise.all([
        client.fetchPokemon(id, options),
        client.fetchPokemonSpecies(id, options),
      ]);
      return toListItem(pokemon, species);
    }),
  );

  const nextOffset = list.next === null ? null : params.offset + params.limit;

  return {
    count: list.count,
    offset: params.offset,
    limit: params.limit,
    nextOffset,
    results,
  };
}
