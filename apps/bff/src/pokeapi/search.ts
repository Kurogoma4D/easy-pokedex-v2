import type { PokeApiClient, RequestOptions } from './client.js';
import { PokeApiError } from './errors.js';
import { extractIdFromResourceUrl, mapWithConcurrency } from './list.js';
import { buildLocalizedName, selectImageUrl } from './localization.js';
import type {
  PokeApiGeneration,
  PokeApiPokemon,
  PokeApiPokemonSpecies,
  PokeApiType,
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
 * 上流 1 リクエスト（species のみ）が発生するため、無制限だと上流へ過大な負荷をかける。実害を
 * 避けるため候補数に上限を設け、超過時は以降を切り捨てる。
 */
const NAME_ONLY_CANDIDATE_CAP = 1500;

/** 上流の `/pokemon` 一覧を 1 リクエストで引くための十分大きな件数。全国図鑑の総数を上回る値。 */
const FULL_LIST_LIMIT = 100_000;

/**
 * 別フォーム（メガ進化・地方フォーム等）の pokemon id はこの値以上に振られる（既定フォームは
 * 全国図鑑番号と一致する 1〜1025）。`/type` のメンバーは pokemon id 空間（別フォームを含む）だが、
 * `/generation` のメンバーと種取得は species id 空間（1〜1025）であり ID 空間が一致しない。
 * 候補は既定フォーム（< この値）に正規化して単一の ID 空間に揃え、別フォーム id での species 取得が
 * 上流 404 を招くこと、およびタイプ×世代の積集合が別フォームを取りこぼすことを防ぐ。
 */
const ALTERNATE_FORM_ID_THRESHOLD = 10_000;

function isDefaultFormId(id: number): boolean {
  return id < ALTERNATE_FORM_ID_THRESHOLD;
}

/**
 * 候補 1 体分の解決済み情報。`slug` は英語の既定フォーム識別子（例: `bulbasaur`）で、
 * 安価なメンバー集合（`/pokemon` 一覧・`/type` メンバー・`/generation` 種）の `name` から取得する。
 */
export interface Candidate {
  readonly id: number;
  readonly slug: string;
}

interface CandidateMaterial {
  readonly id: number;
  readonly pokemon: PokeApiPokemon;
  readonly species: PokeApiPokemonSpecies;
}

/**
 * 名前フィルタのマッチ判定に必要な最小の素材。`/pokemon` は引かず species のみを取得する。
 * `slug` は候補の英語識別子（例: `bulbasaur`）で、英語スラッグでの部分一致に用いる。
 */
interface NameMatchMaterial {
  readonly id: number;
  readonly slug: string;
  readonly species: PokeApiPokemonSpecies;
}

/** 部分一致用に大小文字・前後空白を正規化する。 */
function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/** ひらがなのコードポイント範囲（U+3041「ぁ」〜U+3096「ゖ」）。 */
const HIRAGANA_START = 0x3041;
const HIRAGANA_END = 0x3096;

/** ひらがな→カタカナへ揃えるためのコードポイント差分（同一字種間で +0x60）。 */
const HIRAGANA_TO_KATAKANA_OFFSET = 0x60;

/**
 * かな種別と全角/半角の差異を吸収してカタカナへ正規化する。
 *
 * PokeAPI の `ja-Hrkt` 名はカタカナ（例: リザードン）で提供される一方、日本語 IME の既定入力は
 * ひらがな。種別を揃えないとひらがな入力がカタカナ名にヒットしない。まず NFKC で全角英数字と
 * 半角カタカナを標準形へ畳み込み、続いてひらがなを +0x60 のコードポイントシフトでカタカナへ写す。
 */
export function normalizeKana(value: string): string {
  const folded = value.normalize('NFKC');
  let result = '';
  for (const char of folded) {
    const code = char.codePointAt(0)!;
    if (code >= HIRAGANA_START && code <= HIRAGANA_END) {
      result += String.fromCodePoint(code + HIRAGANA_TO_KATAKANA_OFFSET);
    } else {
      result += char;
    }
  }
  return result;
}

/** 上流 404 か（未知のリソース名はメンバー無しとして扱うための判定）。 */
function isNotFound(error: unknown): boolean {
  return error instanceof PokeApiError && error.kind === 'http' && error.status === 404;
}

/**
 * 未知のタイプ名は上流が 404 を返す。検索では「該当無し」（空メンバー）として扱い、
 * クライアントへ 404 を素通しさせない。404 以外（上流障害等）はそのまま伝播する。
 */
async function mapNotFoundToEmptyType(
  promise: Promise<PokeApiType>,
): Promise<{ readonly pokemon: PokeApiType['pokemon'] }> {
  try {
    return await promise;
  } catch (error) {
    if (isNotFound(error)) {
      return { pokemon: [] };
    }
    throw error;
  }
}

/** 未知の世代名も同様に「該当無し」（空メンバー）として扱う。 */
async function mapNotFoundToEmptyGeneration(
  promise: Promise<PokeApiGeneration>,
): Promise<{ readonly pokemon_species: PokeApiGeneration['pokemon_species'] }> {
  try {
    return await promise;
  } catch (error) {
    if (isNotFound(error)) {
      return { pokemon_species: [] };
    }
    throw error;
  }
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
export async function resolveCandidates(
  client: PokeApiClient,
  params: PokemonSearchParams,
  options: RequestOptions | undefined,
): Promise<Candidate[]> {
  const sets: Set<number>[] = [];
  // 安価なメンバー集合から得た英語スラッグ。複数集合に同一 id が現れた場合は先勝ちで保持する。
  const slugById = new Map<number, string>();

  const rememberSlug = (id: number, slug: string): void => {
    if (!slugById.has(id)) {
      slugById.set(id, slug);
    }
  };

  const typeNames = (params.types ?? []).map(normalize).filter((t) => t.length > 0);
  for (const typeName of typeNames) {
    const type = await mapNotFoundToEmptyType(client.fetchType(typeName, options));
    // type のメンバーは pokemon id 空間（別フォーム含む）。species id 空間（世代・種取得）と
    // 揃えるため、既定フォーム（全国図鑑番号）のみに正規化してから積集合に用いる。
    const ids = new Set<number>();
    for (const entry of type.pokemon) {
      const id = extractIdFromResourceUrl(entry.pokemon.url);
      if (!isDefaultFormId(id)) {
        continue;
      }
      ids.add(id);
      rememberSlug(id, entry.pokemon.name);
    }
    sets.push(ids);
  }

  if (params.generation !== undefined && normalize(params.generation).length > 0) {
    const generation = await mapNotFoundToEmptyGeneration(
      client.fetchGeneration(normalize(params.generation), options),
    );
    const ids = new Set<number>();
    for (const entry of generation.pokemon_species) {
      const id = extractIdFromResourceUrl(entry.url);
      ids.add(id);
      rememberSlug(id, entry.name);
    }
    sets.push(ids);
  }

  if (sets.length === 0) {
    const list = await client.fetchPokemonList({ limit: FULL_LIST_LIMIT, offset: 0 }, options);
    // `/pokemon` 一覧は別フォーム（id >= ALTERNATE_FORM_ID_THRESHOLD）を含む。別フォーム id での
    // species 取得は上流 404 で後段の 404 ガードに落ちるため候補としては無意味で、
    // NAME_ONLY_CANDIDATE_CAP の枠を浪費する。タイプ集合の正規化と同様に既定フォームのみへ揃える。
    const candidates: Candidate[] = [];
    for (const entry of list.results) {
      const id = extractIdFromResourceUrl(entry.url);
      if (!isDefaultFormId(id)) {
        continue;
      }
      candidates.push({ id, slug: entry.name });
    }
    return candidates;
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
  intersection.sort((a, b) => a - b);
  return intersection.map((id) => ({ id, slug: slugById.get(id) ?? String(id) }));
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

/**
 * species の多言語名と候補の英語スラッグだけで名前一致を判定する（`/pokemon` は不要）。
 * en は表示名・スラッグ双方を対象にする（クエリが `bulbasaur` でも `Bulbasaur` でもヒットさせる）。
 */
function matchesName(material: NameMatchMaterial, query: string): boolean {
  const localized = buildLocalizedName(material.species.names, material.slug);
  const haystacks = [localized.en, localized.ja, material.slug].map(normalize);
  return haystacks.some((value) => value.includes(query));
}

/**
 * ポケモンを名前（ja/en 部分一致）・タイプ（複数 AND）・世代で絞り込んで返す（FR-2 / FR-5）。
 *
 * 検索はクライアントへ一覧を渡さず BFF 側で完結させる（spec 10. Open Questions）。タイプ・世代は
 * 上流のメンバー集合を積集合して候補 id を安価に求める。名前フィルタのマッチ判定は候補 1 体ごとに
 * `/pokemon-species` のみを引いて ja/en 名（と英語スラッグ）で行う。`/pokemon` の取得は判定後の
 * ページ分の候補に限って遅延させるため、候補 1 体あたりの上流ファンアウトが 2（pokemon+species）
 * から 1（species のみ）へ半減する。上流アクセスは注入された PokeApiClient（キャッシュ・単一
 * フライト込み）経由で行い、個別取得はワーカープールで同時実行数を抑える。タイプ・世代の指定が
 * 無く名前のみで検索する場合は候補が全件に広がるため、候補数に上限（NAME_ONLY_CANDIDATE_CAP）を
 * 設けて上流負荷を抑える。
 *
 * count はマッチした species の件数を権威とする。ページ分の `/pokemon` が後段で 404 になった場合、
 * results は count より少なくなりうる。ページネーションは絞り込み後の結果集合に対して行い、
 * レスポンス 1 要素の形は一覧と揃える。
 */
export async function searchPokemon(
  client: PokeApiClient,
  params: PokemonSearchParams,
  options?: RequestOptions,
  concurrency: number = DEFAULT_SEARCH_CONCURRENCY,
): Promise<PokemonSearchResponse> {
  const nameQuery = params.name === undefined ? '' : normalize(params.name);
  const hasNameFilter = nameQuery.length > 0;

  let candidates = await resolveCandidates(client, params, options);

  const hasMembershipFilter =
    (params.types ?? []).some((t) => normalize(t).length > 0) ||
    (params.generation !== undefined && normalize(params.generation).length > 0);

  // 名前のみの検索は候補が全件に広がり候補 1 体ごとに上流取得が発生するため、候補数を
  // NAME_ONLY_CANDIDATE_CAP で切り捨てて上流負荷の上限を保つ（超過分は走査対象から除外する）。
  if (hasNameFilter && !hasMembershipFilter && candidates.length > NAME_ONLY_CANDIDATE_CAP) {
    candidates = candidates.slice(0, NAME_ONLY_CANDIDATE_CAP);
  }

  // 名前フィルタが無くタイプ／世代だけのときは、候補 id 群をそのままページングしてから素材を
  // 取得すれば足りる（全候補の species を引かずに済む）。名前フィルタがあるときは ja/en 名の
  // 判定に全候補の species が要るため、先に species のみを取得してから絞り込む。
  if (!hasNameFilter) {
    const total = candidates.length;
    const pageIds = candidates.slice(params.offset, params.offset + params.limit).map((c) => c.id);
    const materials = await fetchMaterials(client, pageIds, options, concurrency);
    const results = materials.map(toListItem);
    // ページネーションはマッチ集合に対して進める。ページの `/pokemon` 404 で results が
    // pageIds より少なくなっても、消費した候補数（pageIds.length）で nextOffset を計算し、
    // 隙間・重複の無い 1 ページ分を確実に前進させる。
    return buildResponse(results, total, pageIds.length, params);
  }

  // マッチ判定は species のみで行い、`/pokemon` の取得はページ分の候補に限って遅延させる。
  // これにより非マッチ候補の `/pokemon` 取得が発生せず、候補 1 体あたりのファンアウトが半減する。
  const nameMaterials = await fetchNameMatchMaterials(client, candidates, options, concurrency);
  const matched = nameMaterials.filter((material) => matchesName(material, nameQuery));
  // count はマッチした species の件数を権威とする（results はページの `/pokemon` 404 で少なくなりうる）。
  const total = matched.length;
  const page = matched.slice(params.offset, params.offset + params.limit);
  const pageMaterials = await fetchMaterials(
    client,
    page.map((m) => m.id),
    options,
    concurrency,
  );
  const results = pageMaterials.map(toListItem);
  // count はマッチした species 件数を権威とする一方、results はページの `/pokemon` 404 で
  // 少なくなりうる。ページネーションは消費したマッチ候補数（page.length）で前進させ、
  // results.length に依存させない。これにより 404 で 1 体落ちても次ページが落ちた候補の次から
  // 始まり、その次の候補を重複返却したり落ちた枠を取りこぼしたりしない。
  return buildResponse(results, total, page.length, params);
}

/**
 * 候補ごとに `/pokemon-species` のみを取得し、名前マッチ判定用の素材を入力順にまとめる。
 *
 * species が上流 404 を返した候補はスキップする（その 1 体の欠落で検索全体を 502 に落とさない）。
 * 404 以外（上流障害等）はそのまま伝播し、従来どおり 502 へ写像させる。
 */
async function fetchNameMatchMaterials(
  client: PokeApiClient,
  candidates: readonly Candidate[],
  options: RequestOptions | undefined,
  concurrency: number,
): Promise<NameMatchMaterial[]> {
  const speciesList = new Array<PokeApiPokemonSpecies | undefined>(candidates.length);

  await mapWithConcurrency(candidates, concurrency, async (candidate, index) => {
    try {
      speciesList[index] = await client.fetchPokemonSpecies(candidate.id, options);
    } catch (error) {
      if (isNotFound(error)) {
        return;
      }
      throw error;
    }
  });

  const materials: NameMatchMaterial[] = [];
  candidates.forEach((candidate, index) => {
    const species = speciesList[index];
    if (species === undefined) {
      return;
    }
    materials.push({ id: candidate.id, slug: candidate.slug, species });
  });
  return materials;
}

/**
 * 候補 id 群の pokemon/species を同時実行数を抑えつつ取得し、入力順の素材配列にまとめる。
 *
 * いずれかの取得が上流 404 を返した候補はスキップする（その 1 体の欠落で検索全体を 502 に
 * 落とさない）。404 以外（上流障害等）はそのまま伝播し、従来どおり 502 へ写像させる。
 */
async function fetchMaterials(
  client: PokeApiClient,
  ids: readonly number[],
  options: RequestOptions | undefined,
  concurrency: number,
): Promise<CandidateMaterial[]> {
  const pokemons = new Array<PokeApiPokemon | undefined>(ids.length);
  const speciesList = new Array<PokeApiPokemonSpecies | undefined>(ids.length);
  const dropped = new Array<boolean>(ids.length).fill(false);

  type Task =
    | { readonly kind: 'pokemon'; readonly index: number; readonly id: number }
    | { readonly kind: 'species'; readonly index: number; readonly id: number };

  const tasks: Task[] = ids.flatMap((id, index) => [
    { kind: 'pokemon', index, id },
    { kind: 'species', index, id },
  ]);

  await mapWithConcurrency(tasks, concurrency, async (task) => {
    try {
      if (task.kind === 'pokemon') {
        pokemons[task.index] = await client.fetchPokemon(task.id, options);
      } else {
        // 世代の pokemon_species は種 id。default フォームでは pokemon id と一致するため、
        // species 取得には pokemon の参照する species 名ではなく候補 id をそのまま用いる。
        speciesList[task.index] = await client.fetchPokemonSpecies(task.id, options);
      }
    } catch (error) {
      if (isNotFound(error)) {
        dropped[task.index] = true;
        return;
      }
      throw error;
    }
  });

  const materials: CandidateMaterial[] = [];
  ids.forEach((id, index) => {
    if (dropped[index]) {
      return;
    }
    const pokemon = pokemons[index];
    const species = speciesList[index];
    // 一方が 404 で落ちていなくても、両方揃わない候補は素材化できないためスキップする。
    if (pokemon === undefined || species === undefined) {
      return;
    }
    materials.push({ id, pokemon, species });
  });
  return materials;
}

/**
 * `consumed` はこのページで消費したマッチ候補数（ページスライスの長さ）であり、results の
 * 長さではない。ページの `/pokemon` 404 で results.length < consumed になっても、nextOffset は
 * 消費した候補数で前進させ、隙間・重複の無いページングを保つ。
 */
function buildResponse(
  results: readonly PokemonListItem[],
  total: number,
  consumed: number,
  params: PokemonSearchParams,
): PokemonSearchResponse {
  const nextStart = params.offset + consumed;
  const nextOffset = nextStart < total ? nextStart : null;
  return {
    count: total,
    offset: params.offset,
    limit: params.limit,
    nextOffset,
    results,
  };
}
