import type { PokeApiClient, RequestOptions } from './client.js';
import { extractIdFromResourceUrl, mapWithConcurrency } from './list.js';
import { buildLocalizedName, selectImageUrl } from './localization.js';
import type {
  PokeApiPokemon,
  PokeApiPokemonSpecies,
  PokemonListItem,
  PokemonSearchParams,
  PokemonSearchResponse,
} from './types.js';

/**
 * 上流ファンアウトの既定同時実行数。候補の pokemon/species 個別取得が一斉に飛ぶと
 * レート制限に触れて連鎖失敗するため、ワーカープールでバウンドする（一覧・詳細と同方針）。
 */
const DEFAULT_SEARCH_CONCURRENCY = 6;

/**
 * 名前による全件走査時に上流へ問い合わせる候補の上限。
 *
 * タイプ・世代の指定が無く名前のみで検索する場合、絞り込みのための安価なメンバー集合が
 * 無いため候補が全ポケモンに広がる。ja 名のマッチには species の多言語名が要り、候補 1 体ごとに
 * 上流 1 リクエストが発生するため、無制限だと上流へ過大な負荷をかける。実害を避けるため候補数に
 * 上限を設け、超過時はログを出して以降を切り捨てる。
 */
const NAME_ONLY_CANDIDATE_CAP = 1500;

/** 上流の `/pokemon` 一覧を 1 リクエストで引くための十分大きな件数。全国図鑑の総数を上回る値。 */
const FULL_LIST_LIMIT = 100_000;

interface CandidateMaterial {
  readonly id: number;
  readonly pokemon: PokeApiPokemon;
  readonly species: PokeApiPokemonSpecies;
}

/** 部分一致用に大小文字・前後空白を正規化する。 */
function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * タイプ・世代のメンバー集合から候補 id を求める。
 *
 * - タイプは指定タイプすべてを持つもの（AND）に積集合で絞る。
 * - 世代は当該世代の種に絞る。
 * - いずれも未指定なら候補は全ポケモン（上流 `/pokemon` 一覧の id 群）。
 *
 * タイプ・世代のメンバー一覧は上流の 1 リソースで得られるため、全ポケモンを取得して
 * 絞り込むより遥かに安価（spec 7. 上流負荷抑制）。
 */
async function resolveCandidateIds(
  client: PokeApiClient,
  params: PokemonSearchParams,
  options: RequestOptions | undefined,
): Promise<number[]> {
  const sets: Set<number>[] = [];

  const typeNames = (params.types ?? []).map(normalize).filter((t) => t.length > 0);
  for (const typeName of typeNames) {
    const type = await client.fetchType(typeName, options);
    sets.push(new Set(type.pokemon.map((entry) => extractIdFromResourceUrl(entry.pokemon.url))));
  }

  if (params.generation !== undefined && normalize(params.generation).length > 0) {
    const generation = await client.fetchGeneration(normalize(params.generation), options);
    sets.push(
      new Set(generation.pokemon_species.map((entry) => extractIdFromResourceUrl(entry.url))),
    );
  }

  if (sets.length === 0) {
    const list = await client.fetchPokemonList({ limit: FULL_LIST_LIMIT, offset: 0 }, options);
    return list.results.map((entry) => extractIdFromResourceUrl(entry.url));
  }

  // 最小の集合を基準に積集合を取り、走査回数を抑える。
  sets.sort((a, b) => a.size - b.size);
  const [base, ...rest] = sets;
  const intersection: number[] = [];
  for (const id of base!) {
    if (rest.every((set) => set.has(id))) {
      intersection.push(id);
    }
  }
  // メンバー一覧の並びは安定とは限らないため、図鑑番号順で返す。
  return intersection.sort((a, b) => a - b);
}

function toListItem(material: CandidateMaterial): PokemonListItem {
  const types = [...material.pokemon.types]
    .sort((a, b) => a.slot - b.slot)
    .map((entry) => entry.type.name);
  return {
    id: material.id,
    imageUrl: selectImageUrl(material.pokemon),
    name: buildLocalizedName(material.species.names, material.pokemon.name),
    types,
  };
}

function matchesName(material: CandidateMaterial, query: string): boolean {
  const localized = buildLocalizedName(material.species.names, material.pokemon.name);
  // en は表示名・スラッグ双方を対象にする（クエリが `bulbasaur` でも `Bulbasaur` でもヒットさせる）。
  const haystacks = [localized.en, localized.ja, material.pokemon.name].map(normalize);
  return haystacks.some((value) => value.includes(query));
}

/**
 * ポケモンを名前（ja/en 部分一致）・タイプ（複数 AND）・世代で絞り込んで返す（FR-2 / FR-5）。
 *
 * 検索はクライアントへ一覧を渡さず BFF 側で完結させる（spec 10. Open Questions）。タイプ・世代は
 * 上流のメンバー集合を積集合して候補 id を安価に求める。名前フィルタは候補 1 体ごとに
 * `/pokemon` `/pokemon-species` を引いて ja/en 名を解決する必要があるため、上流アクセスは
 * 注入された PokeApiClient（キャッシュ・単一フライト込み）経由で行い、個別取得はワーカープールで
 * 同時実行数を抑える。タイプ・世代の指定が無く名前のみで検索する場合は候補が全件に広がるため、
 * 候補数に上限（NAME_ONLY_CANDIDATE_CAP）を設けて上流負荷を抑える。
 *
 * ページネーションは絞り込み後の結果集合に対して行い、レスポンス 1 要素の形は一覧と揃える。
 */
export async function searchPokemon(
  client: PokeApiClient,
  params: PokemonSearchParams,
  options?: RequestOptions,
  concurrency: number = DEFAULT_SEARCH_CONCURRENCY,
): Promise<PokemonSearchResponse> {
  const nameQuery = params.name === undefined ? '' : normalize(params.name);
  const hasNameFilter = nameQuery.length > 0;

  let candidateIds = await resolveCandidateIds(client, params, options);

  const hasMembershipFilter =
    (params.types ?? []).some((t) => normalize(t).length > 0) ||
    (params.generation !== undefined && normalize(params.generation).length > 0);

  // 名前のみの検索は候補が全件に広がるため上限で切り捨てる（上流負荷の上限）。
  if (hasNameFilter && !hasMembershipFilter && candidateIds.length > NAME_ONLY_CANDIDATE_CAP) {
    console.warn(
      `[search] name-only query "${nameQuery}" produced ${candidateIds.length} candidates; ` +
        `capping upstream lookups at ${NAME_ONLY_CANDIDATE_CAP}.`,
    );
    candidateIds = candidateIds.slice(0, NAME_ONLY_CANDIDATE_CAP);
  }

  // 名前フィルタが無くタイプ／世代だけのときは、候補 id 群をそのままページングしてから素材を
  // 取得すれば足りる（全候補の species を引かずに済む）。名前フィルタがあるときは ja/en 名の
  // 判定に全候補の素材が要るため、先に素材を取得してから絞り込む。
  if (!hasNameFilter) {
    const total = candidateIds.length;
    const pageIds = candidateIds.slice(params.offset, params.offset + params.limit);
    const materials = await fetchMaterials(client, pageIds, options, concurrency);
    const results = materials.map(toListItem);
    return buildResponse(results, total, params);
  }

  const materials = await fetchMaterials(client, candidateIds, options, concurrency);
  const matched = materials.filter((material) => matchesName(material, nameQuery));
  const total = matched.length;
  const page = matched.slice(params.offset, params.offset + params.limit);
  const results = page.map(toListItem);
  return buildResponse(results, total, params);
}

/** 候補 id 群の pokemon/species を同時実行数を抑えつつ取得し、入力順の素材配列にまとめる。 */
async function fetchMaterials(
  client: PokeApiClient,
  ids: readonly number[],
  options: RequestOptions | undefined,
  concurrency: number,
): Promise<CandidateMaterial[]> {
  const pokemons = new Array<PokeApiPokemon>(ids.length);
  const speciesList = new Array<PokeApiPokemonSpecies>(ids.length);

  type Task =
    | { readonly kind: 'pokemon'; readonly index: number; readonly id: number }
    | { readonly kind: 'species'; readonly index: number; readonly id: number };

  const tasks: Task[] = ids.flatMap((id, index) => [
    { kind: 'pokemon', index, id },
    { kind: 'species', index, id },
  ]);

  await mapWithConcurrency(tasks, concurrency, async (task) => {
    if (task.kind === 'pokemon') {
      pokemons[task.index] = await client.fetchPokemon(task.id, options);
    } else {
      // 世代の pokemon_species は種 id。default フォームでは pokemon id と一致するため、
      // species 取得には pokemon の参照する species 名ではなく候補 id をそのまま用いる。
      speciesList[task.index] = await client.fetchPokemonSpecies(task.id, options);
    }
  });

  return ids.map((id, index) => ({
    id,
    pokemon: pokemons[index]!,
    species: speciesList[index]!,
  }));
}

function buildResponse(
  results: readonly PokemonListItem[],
  total: number,
  params: PokemonSearchParams,
): PokemonSearchResponse {
  const consumed = params.offset + results.length;
  const nextOffset = consumed < total ? consumed : null;
  return {
    count: total,
    offset: params.offset,
    limit: params.limit,
    nextOffset,
    results,
  };
}
