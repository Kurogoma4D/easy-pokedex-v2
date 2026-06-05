import type { PokeApiClient, RequestOptions } from './client.js';
import { extractIdFromResourceUrl, mapWithConcurrency } from './list.js';
import {
  buildLocalizedFlavorText,
  buildLocalizedGenus,
  buildLocalizedName,
  selectCryUrl,
  selectImageUrl,
} from './localization.js';
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
  PokemonTypeMatchupType,
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
 * 防御側 1 タイプの被ダメージ相性から、攻撃タイプ名→倍率の写像を作る。
 * double=2 / half=0.5 / no=0 のいずれにも無い攻撃タイプは等倍（1）として扱う（暗黙の既定）。
 */
function incomingFactors(type: PokeApiType): Map<string, number> {
  const factors = new Map<string, number>();
  for (const entry of type.damage_relations.double_damage_from) factors.set(entry.name, 2);
  for (const entry of type.damage_relations.half_damage_from) factors.set(entry.name, 0.5);
  for (const entry of type.damage_relations.no_damage_from) factors.set(entry.name, 0);
  return factors;
}

/**
 * 防御側ポケモンのタイプ構成から被ダメージ相性（弱点/耐性/無効）を算出する。
 *
 * 各防御タイプの被ダメージ倍率（2 / 0.5 / 0 / 既定 1）を、攻撃タイプごとに掛け合わせて
 * 最終倍率を求める。攻撃タイプの母集合は防御各タイプの `damage_relations` 出現の和集合とし、
 * `past_damage_relations` は対象外。等倍（×1）は分類から除外し、倍率降順で並べる。
 * 攻撃タイプの表示名は `/type` の多言語名から解決し、未取得時は識別子へフォールバックする。
 */
export function computeTypeMatchups(
  defenderTypeNames: readonly string[],
  typeByName: ReadonlyMap<string, PokeApiType>,
): PokemonTypeMatchups {
  const defenderTypes = defenderTypeNames
    .map((name) => typeByName.get(name))
    .filter((type): type is PokeApiType => type !== undefined);

  // 攻撃タイプの母集合（防御各タイプの damage_relations に現れる攻撃タイプの和集合）。
  const attackerNames = new Set<string>();
  for (const type of defenderTypes) {
    for (const name of incomingFactors(type).keys()) attackerNames.add(name);
  }

  const multiplierByAttacker = new Map<string, number>();
  for (const attacker of attackerNames) {
    let multiplier = 1;
    for (const type of defenderTypes) {
      multiplier *= incomingFactors(type).get(attacker) ?? 1;
    }
    multiplierByAttacker.set(attacker, multiplier);
  }

  const localizedType = (name: string): PokemonTypeMatchupType => {
    const upstream = typeByName.get(name);
    return {
      id: name,
      name:
        upstream !== undefined ? buildLocalizedName(upstream.names, name) : { ja: name, en: name },
    };
  };

  // 倍率ごとに攻撃タイプをまとめる。等倍（×1）は相性表に出さない。
  const typesByMultiplier = new Map<number, PokemonTypeMatchupType[]>();
  for (const [attacker, multiplier] of multiplierByAttacker) {
    if (multiplier === 1) continue;
    const bucket = typesByMultiplier.get(multiplier);
    if (bucket !== undefined) {
      bucket.push(localizedType(attacker));
    } else {
      typesByMultiplier.set(multiplier, [localizedType(attacker)]);
    }
  }

  const groups: PokemonTypeMatchupGroup[] = [...typesByMultiplier.entries()]
    .map(([multiplier, types]) => ({ multiplier, types }))
    .sort((a, b) => b.multiplier - a.multiplier);

  return {
    weaknesses: groups.filter((group) => group.multiplier > 1),
    resistances: groups.filter((group) => group.multiplier > 0 && group.multiplier < 1),
    immunities: groups.filter((group) => group.multiplier === 0),
  };
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

  // 相性算出に使う攻撃タイプの表示名を解決するため、自タイプの damage_relations に現れる
  // 攻撃タイプのうち未取得のものを追加で取得する（自タイプの取得完了後でないと母集合が定まらない）。
  const attackerTypeNames = new Set<string>();
  for (const name of typeNames) {
    const type = typeByName.get(name);
    if (type === undefined) continue;
    for (const entry of type.damage_relations.double_damage_from) attackerTypeNames.add(entry.name);
    for (const entry of type.damage_relations.half_damage_from) attackerTypeNames.add(entry.name);
    for (const entry of type.damage_relations.no_damage_from) attackerTypeNames.add(entry.name);
  }
  const missingAttackerTypeNames = [...attackerTypeNames].filter((name) => !typeByName.has(name));

  await mapWithConcurrency(missingAttackerTypeNames, detailConcurrency, async (name) => {
    typeByName.set(name, await client.fetchType(name, options));
  });

  return {
    id: pokemon.id,
    name: buildLocalizedName(species.names, pokemon.name),
    imageUrl: selectImageUrl(pokemon),
    height: pokemon.height,
    weight: pokemon.weight,
    types: toTypeDetails(pokemon, typeByName),
    stats: toStats(pokemon),
    abilities: toAbilityDetails(pokemon, abilityByName),
    evolutionChain: toEvolutionNode(evolutionChain.chain, pokemonById, speciesById),
    typeMatchups: computeTypeMatchups(typeNames, typeByName),
    flavorText: buildLocalizedFlavorText(species.flavor_text_entries),
    genus: buildLocalizedGenus(species.genera),
    generation: species.generation.name,
    isLegendary: species.is_legendary,
    isMythical: species.is_mythical,
    cryUrl: selectCryUrl(pokemon),
  };
}
