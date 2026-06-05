import type { PokeApiClient, RequestOptions } from './client.js';
import { extractIdFromResourceUrl, mapWithConcurrency } from './list.js';
import { buildLocalizedName, selectImageUrl } from './localization.js';
import type {
  EvolutionNode,
  PokeApiAbility,
  PokeApiEvolutionChainLink,
  PokeApiPokemon,
  PokeApiPokemonSpecies,
  PokeApiType,
  PokemonAbilityDetail,
  PokemonDetail,
  PokemonStatDetail,
  PokemonTypeDetail,
  PokemonTypeMatchupGroup,
  PokemonTypeMatchups,
} from './types.js';

/**
 * 詳細取得時の上流ファンアウトの既定同時実行数。type/ability/進化メンバーの個別取得が
 * 一斉に上流へ飛ぶとレート制限に触れて連鎖失敗するため、ワーカープールでバウンドする（一覧と同方針）。
 */
const DEFAULT_DETAIL_CONCURRENCY = 6;

/** 進化チェーンを前順走査し、各ノードの species を出現順に列挙する。 */
function flattenEvolutionLinks(link: PokeApiEvolutionChainLink): PokeApiEvolutionChainLink[] {
  return [link, ...link.evolves_to.flatMap((next) => flattenEvolutionLinks(next))];
}

/**
 * 進化チェーンのツリーを、解決済みの species id→pokemon/species から DTO ツリーへ写す。
 * 名前・画像を埋めるため、各ノードの素材は事前に取得済みであることを前提とする。
 */
function toEvolutionNode(
  link: PokeApiEvolutionChainLink,
  pokemonById: ReadonlyMap<number, PokeApiPokemon>,
  speciesById: ReadonlyMap<number, PokeApiPokemonSpecies>,
): EvolutionNode {
  const id = extractIdFromResourceUrl(link.species.url);
  const pokemon = pokemonById.get(id);
  const species = speciesById.get(id);
  // 名前は species 由来。pokemon が取れない場合でも species 名で代替し描画を止めない。
  const fallbackName = species?.name ?? link.species.name;
  return {
    id,
    name:
      species !== undefined
        ? buildLocalizedName(species.names, fallbackName)
        : { ja: fallbackName, en: fallbackName },
    imageUrl: pokemon !== undefined ? selectImageUrl(pokemon) : null,
    evolvesTo: link.evolves_to.map((next) => toEvolutionNode(next, pokemonById, speciesById)),
  };
}

function toStats(pokemon: PokeApiPokemon): PokemonStatDetail[] {
  return pokemon.stats.map((entry) => ({ id: entry.stat.name, base: entry.base_stat }));
}

function toTypeDetails(
  pokemon: PokeApiPokemon,
  typeByName: ReadonlyMap<string, PokeApiType>,
): PokemonTypeDetail[] {
  return [...pokemon.types]
    .sort((a, b) => a.slot - b.slot)
    .map((entry) => {
      const id = entry.type.name;
      const upstream = typeByName.get(id);
      return {
        id,
        name: upstream !== undefined ? buildLocalizedName(upstream.names, id) : { ja: id, en: id },
      };
    });
}

const EMPTY_DAMAGE_RELATIONS = {
  double_damage_from: [] as const,
  half_damage_from: [] as const,
  no_damage_from: [] as const,
} as const;

/** 上流が damage_relations を欠く場合（旧フィクスチャや想定外レスポンス）でも空の関係で扱えるようにする。 */
function damageRelationsOf(type: PokeApiType): PokeApiType['damage_relations'] {
  return type.damage_relations ?? EMPTY_DAMAGE_RELATIONS;
}

/**
 * 1 つの攻撃側タイプ A が、防御側タイプ 1 つに対して持つ被ダメージ係数を返す。
 * `double_damage_from` に A があれば 2、`half_damage_from` なら 0.5、`no_damage_from` なら 0、
 * いずれにも無ければ等倍の 1。`past_damage_relations` は参照しない。
 */
function damageFactorAgainstType(defenderType: PokeApiType, attackingTypeName: string): number {
  const { double_damage_from, half_damage_from, no_damage_from } = damageRelationsOf(defenderType);
  if (no_damage_from.some((entry) => entry.name === attackingTypeName)) {
    return 0;
  }
  if (double_damage_from.some((entry) => entry.name === attackingTypeName)) {
    return 2;
  }
  if (half_damage_from.some((entry) => entry.name === attackingTypeName)) {
    return 0.5;
  }
  return 1;
}

/**
 * ポケモンのタイプ構成に対する被ダメージ相性を算出する。複合タイプは各防御タイプの被ダメ係数を
 * 掛け合わせ、最終倍率（×4 / ×2 / ×0.5 / ×0.25 / ×0 等）で攻撃側タイプを分類する。等倍（×1）は含めない。
 *
 * 攻撃側タイプの母集合は防御側タイプの `damage_relations`（double/half/no_damage_from）に現れる
 * タイプの和集合とする。これら以外の攻撃タイプはすべての防御タイプに対し等倍であり、相性に現れないため。
 * 表示名は `typeByName` の多言語名から解決し、欠ける場合は識別子へフォールバックする。
 */
export function computeTypeMatchups(
  defenderTypeNames: readonly string[],
  typeByName: ReadonlyMap<string, PokeApiType>,
): PokemonTypeMatchups {
  const defenderTypes = defenderTypeNames
    .map((name) => typeByName.get(name))
    .filter((type): type is PokeApiType => type !== undefined);

  // 攻撃側タイプの母集合（等倍以外になりうる候補）を防御側の damage_relations から集める。
  const attackingTypeNames = new Set<string>();
  for (const defenderType of defenderTypes) {
    const { double_damage_from, half_damage_from, no_damage_from } =
      damageRelationsOf(defenderType);
    for (const entry of [...double_damage_from, ...half_damage_from, ...no_damage_from]) {
      attackingTypeNames.add(entry.name);
    }
  }

  const byMultiplier = new Map<number, string[]>();
  for (const attackingTypeName of [...attackingTypeNames].sort()) {
    const multiplier = defenderTypes.reduce(
      (acc, defenderType) => acc * damageFactorAgainstType(defenderType, attackingTypeName),
      1,
    );
    if (multiplier === 1) {
      continue;
    }
    const bucket = byMultiplier.get(multiplier);
    if (bucket === undefined) {
      byMultiplier.set(multiplier, [attackingTypeName]);
    } else {
      bucket.push(attackingTypeName);
    }
  }

  const toGroups = (predicate: (multiplier: number) => boolean): PokemonTypeMatchupGroup[] =>
    [...byMultiplier.entries()]
      .filter(([multiplier]) => predicate(multiplier))
      // 倍率の降順（弱点は ×4 → ×2、耐性は ×0.5 → ×0.25）。
      .sort(([a], [b]) => b - a)
      .map(([multiplier, typeNames]) => ({
        multiplier,
        types: typeNames.map((name) => {
          const upstream = typeByName.get(name);
          return {
            id: name,
            name:
              upstream !== undefined
                ? buildLocalizedName(upstream.names, name)
                : { ja: name, en: name },
          };
        }),
      }));

  return {
    weaknesses: toGroups((multiplier) => multiplier > 1),
    resistances: toGroups((multiplier) => multiplier > 0 && multiplier < 1),
    immunities: toGroups((multiplier) => multiplier === 0),
  };
}

function toAbilityDetails(
  pokemon: PokeApiPokemon,
  abilityByName: ReadonlyMap<string, PokeApiAbility>,
): PokemonAbilityDetail[] {
  return [...pokemon.abilities]
    .sort((a, b) => a.slot - b.slot)
    .map((entry) => {
      const id = entry.ability.name;
      const upstream = abilityByName.get(id);
      return {
        id,
        name: upstream !== undefined ? buildLocalizedName(upstream.names, id) : { ja: id, en: id },
        isHidden: entry.is_hidden,
      };
    });
}

/**
 * 1 体のポケモンの詳細を整形して返す（FR-3 / FR-4 / FR-5）。
 *
 * `/pokemon/{idOrName}` と `/pokemon-species/{idOrName}` を起点に、species の参照する
 * `/evolution-chain/{id}` を辿り、図鑑番号・名前・画像・タイプ・ステータス・特性・進化チェーンを
 * 1 レスポンスへ集約する。固有名詞（名前・タイプ名・特性名）は `/type` `/ability` の多言語名から
 * ja/en 双方を解決する。上流アクセスはすべて注入された PokeApiClient（キャッシュ・単一フライト込み）
 * 経由で行い、type/ability/進化メンバーの個別取得はワーカープールで同時実行数を抑える。
 */
export async function fetchPokemonDetail(
  client: PokeApiClient,
  idOrName: string | number,
  options?: RequestOptions,
  detailConcurrency: number = DEFAULT_DETAIL_CONCURRENCY,
): Promise<PokemonDetail> {
  const pokemon = await client.fetchPokemon(idOrName, options);
  const species = await client.fetchPokemonSpecies(pokemon.species.name, options);

  const evolutionChainId = extractIdFromResourceUrl(species.evolution_chain.url);
  const evolutionChain = await client.fetchEvolutionChain(evolutionChainId, options);

  const evolutionLinks = flattenEvolutionLinks(evolutionChain.chain);
  const evolutionIds = evolutionLinks.map((link) => extractIdFromResourceUrl(link.species.url));

  const typeNames = [...new Set(pokemon.types.map((entry) => entry.type.name))];
  const abilityNames = [...new Set(pokemon.abilities.map((entry) => entry.ability.name))];
  // 進化チェーン上の素材取得は、起点ポケモン自身を二重取得しないよう除外する。
  const evolutionMemberIds = evolutionIds.filter((id) => id !== pokemon.id);

  const typeByName = new Map<string, PokeApiType>();
  const abilityByName = new Map<string, PokeApiAbility>();
  const pokemonById = new Map<number, PokeApiPokemon>([[pokemon.id, pokemon]]);
  const speciesById = new Map<number, PokeApiPokemonSpecies>([[species.id, species]]);

  // 上流への個別リクエスト 1 本を 1 タスクとして同一プールで処理し、同時実行数を厳密に
  // detailConcurrency 以下へ抑える（一覧エンドポイントと同方針）。
  type DetailTask =
    | { readonly kind: 'type'; readonly name: string }
    | { readonly kind: 'ability'; readonly name: string }
    | { readonly kind: 'evolution-pokemon'; readonly id: number }
    | { readonly kind: 'evolution-species'; readonly id: number };

  const tasks: DetailTask[] = [
    ...typeNames.map((name): DetailTask => ({ kind: 'type', name })),
    ...abilityNames.map((name): DetailTask => ({ kind: 'ability', name })),
    ...evolutionMemberIds.flatMap((id): DetailTask[] => [
      { kind: 'evolution-pokemon', id },
      { kind: 'evolution-species', id },
    ]),
  ];

  await mapWithConcurrency(tasks, detailConcurrency, async (task) => {
    switch (task.kind) {
      case 'type':
        typeByName.set(task.name, await client.fetchType(task.name, options));
        return;
      case 'ability':
        abilityByName.set(task.name, await client.fetchAbility(task.name, options));
        return;
      case 'evolution-pokemon':
        pokemonById.set(task.id, await client.fetchPokemon(task.id, options));
        return;
      case 'evolution-species':
        speciesById.set(task.id, await client.fetchPokemonSpecies(task.id, options));
        return;
    }
  });

  // タイプ相性に現れる攻撃側タイプ（防御タイプの damage_relations 参照先）の多言語名を解決するため、
  // 自タイプの取得後にまだ未取得のタイプを追補する。これらは自タイプの被ダメ関係に現れる集合に限定される。
  const relatedTypeNames = new Set<string>();
  for (const name of typeNames) {
    const upstream = typeByName.get(name);
    if (upstream === undefined) {
      continue;
    }
    const { double_damage_from, half_damage_from, no_damage_from } = damageRelationsOf(upstream);
    for (const entry of [...double_damage_from, ...half_damage_from, ...no_damage_from]) {
      if (!typeByName.has(entry.name)) {
        relatedTypeNames.add(entry.name);
      }
    }
  }

  await mapWithConcurrency([...relatedTypeNames], detailConcurrency, async (name) => {
    typeByName.set(name, await client.fetchType(name, options));
  });

  return {
    id: pokemon.id,
    name: buildLocalizedName(species.names, pokemon.name),
    imageUrl: selectImageUrl(pokemon),
    height: pokemon.height,
    weight: pokemon.weight,
    types: toTypeDetails(pokemon, typeByName),
    typeMatchups: computeTypeMatchups(typeNames, typeByName),
    stats: toStats(pokemon),
    abilities: toAbilityDetails(pokemon, abilityByName),
    evolutionChain: toEvolutionNode(evolutionChain.chain, pokemonById, speciesById),
  };
}
