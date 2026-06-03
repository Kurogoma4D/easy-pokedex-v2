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
 * 個別取得の同時実行数の既定値。一覧 1 ページの cold 取得で上流へ一斉にファンアウトすると
 * PokeAPI のレート制限に触れて連鎖失敗を招くため、ワーカープールでバウンドする。
 */
const DEFAULT_DETAIL_CONCURRENCY = 6;

/**
 * `items` を最大 `concurrency` 並列で `mapper` に通し、結果を入力順で返す。
 * 固定数のワーカーが共有インデックスから次の要素を取り続けるプール方式で、
 * 同時に走る `mapper` 呼び出しが `concurrency` を超えないことを保証する。
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await mapper(items[current]!, current);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
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
  detailConcurrency: number = DEFAULT_DETAIL_CONCURRENCY,
): Promise<PokemonListResponse> {
  const list = await client.fetchPokemonList(params, options);

  const ids = list.results.map((resource) => extractIdFromResourceUrl(resource.url));

  // 上流への個別リクエスト 1 本を 1 タスクとして同一プールで処理し、同時実行数を厳密に
  // detailConcurrency 以下へ抑える。`pokemon` と `species` を別タスクに分けるのは、
  // 1 匹あたり 2 本のリクエストがプールの上限を超えてファンアウトしないようにするため。
  type DetailTask =
    | { readonly kind: 'pokemon'; readonly index: number; readonly id: number }
    | { readonly kind: 'species'; readonly index: number; readonly id: number };

  const tasks: DetailTask[] = ids.flatMap((id, index) => [
    { kind: 'pokemon', index, id },
    { kind: 'species', index, id },
  ]);

  const pokemons = new Array<PokeApiPokemon>(ids.length);
  const speciesList = new Array<PokeApiPokemonSpecies>(ids.length);

  await mapWithConcurrency(tasks, detailConcurrency, async (task) => {
    if (task.kind === 'pokemon') {
      pokemons[task.index] = await client.fetchPokemon(task.id, options);
    } else {
      speciesList[task.index] = await client.fetchPokemonSpecies(task.id, options);
    }
  });

  const results = ids.map((_, index) => toListItem(pokemons[index]!, speciesList[index]!));

  const nextOffset = list.next === null ? null : params.offset + params.limit;

  return {
    count: list.count,
    offset: params.offset,
    limit: params.limit,
    nextOffset,
    results,
  };
}
