import { describe, expect, it, vi } from 'vitest';

import { PokeApiClient } from './client.js';
import { fetchPokemonDetail } from './detail.js';

const UPSTREAM = 'https://upstream.test/api/v2';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

interface PokemonFixture {
  readonly id: number;
  readonly name: string;
  readonly jaName: string;
  readonly enName: string;
  readonly types: readonly string[];
  readonly abilities: readonly { readonly name: string; readonly isHidden: boolean }[];
  readonly stats: readonly { readonly name: string; readonly base: number }[];
  readonly artwork?: string | null;
  readonly frontDefault?: string | null;
}

const BULBASAUR: PokemonFixture = {
  id: 1,
  name: 'bulbasaur',
  jaName: 'フシギダネ',
  enName: 'Bulbasaur',
  types: ['grass', 'poison'],
  abilities: [
    { name: 'overgrow', isHidden: false },
    { name: 'chlorophyll', isHidden: true },
  ],
  stats: [
    { name: 'hp', base: 45 },
    { name: 'attack', base: 49 },
    { name: 'defense', base: 49 },
  ],
  artwork: 'https://img.test/artwork/1.png',
  frontDefault: 'https://img.test/sprite/1.png',
};

const IVYSAUR: PokemonFixture = {
  id: 2,
  name: 'ivysaur',
  jaName: 'フシギソウ',
  enName: 'Ivysaur',
  types: ['grass', 'poison'],
  abilities: [{ name: 'overgrow', isHidden: false }],
  stats: [{ name: 'hp', base: 60 }],
  artwork: null,
  frontDefault: 'https://img.test/sprite/2.png',
};

const VENUSAUR: PokemonFixture = {
  id: 3,
  name: 'venusaur',
  jaName: 'フシギバナ',
  enName: 'Venusaur',
  types: ['grass', 'poison'],
  abilities: [{ name: 'overgrow', isHidden: false }],
  stats: [{ name: 'hp', base: 80 }],
  artwork: 'https://img.test/artwork/3.png',
  frontDefault: 'https://img.test/sprite/3.png',
};

const FIXTURES = [BULBASAUR, IVYSAUR, VENUSAUR] as const;

const TYPE_NAMES: Record<string, { ja: string; en: string }> = {
  grass: { ja: 'くさ', en: 'grass' },
  poison: { ja: 'どく', en: 'poison' },
};

const ABILITY_NAMES: Record<string, { ja: string; en: string }> = {
  overgrow: { ja: 'しんりょく', en: 'Overgrow' },
  chlorophyll: { ja: 'ようりょくそ', en: 'Chlorophyll' },
};

function pokemonBody(f: PokemonFixture): unknown {
  return {
    id: f.id,
    name: f.name,
    height: f.id * 7,
    weight: f.id * 69,
    base_experience: 64,
    types: f.types.map((name, index) => ({ slot: index + 1, type: { name, url: '' } })),
    stats: f.stats.map((s) => ({ base_stat: s.base, effort: 0, stat: { name: s.name, url: '' } })),
    abilities: f.abilities.map((a, index) => ({
      is_hidden: a.isHidden,
      slot: index + 1,
      ability: { name: a.name, url: '' },
    })),
    sprites: {
      front_default: f.frontDefault ?? null,
      front_shiny: null,
      other: { 'official-artwork': { front_default: f.artwork ?? null } },
    },
    species: { name: f.name, url: `${UPSTREAM}/pokemon-species/${f.id}/` },
  };
}

function speciesBody(f: PokemonFixture): unknown {
  return {
    id: f.id,
    name: f.name,
    names: [
      { name: f.jaName, language: { name: 'ja-Hrkt', url: '' } },
      { name: f.enName, language: { name: 'en', url: '' } },
    ],
    flavor_text_entries: [],
    generation: { name: 'generation-i', url: '' },
    evolution_chain: { url: `${UPSTREAM}/evolution-chain/1/` },
    is_legendary: false,
    is_mythical: false,
  };
}

/** Bulbasaur → Ivysaur → Venusaur の直線進化チェーン。 */
function evolutionChainBody(): unknown {
  return {
    id: 1,
    chain: {
      species: { name: 'bulbasaur', url: `${UPSTREAM}/pokemon-species/1/` },
      evolves_to: [
        {
          species: { name: 'ivysaur', url: `${UPSTREAM}/pokemon-species/2/` },
          evolves_to: [
            {
              species: { name: 'venusaur', url: `${UPSTREAM}/pokemon-species/3/` },
              evolves_to: [],
            },
          ],
        },
      ],
    },
  };
}

function makeFetchImpl() {
  return vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const path = new URL(String(input)).pathname;

    const evoMatch = /\/evolution-chain\/(\d+)\/?$/.exec(path);
    if (evoMatch !== null) {
      return jsonResponse(evolutionChainBody());
    }

    const typeMatch = /\/type\/([^/]+)\/?$/.exec(path);
    if (typeMatch !== null) {
      const key = typeMatch[1]!;
      const t = TYPE_NAMES[key];
      if (t === undefined) return new Response('not found', { status: 404 });
      return jsonResponse({
        id: 1,
        name: key,
        names: [
          { name: t.ja, language: { name: 'ja-Hrkt', url: '' } },
          { name: t.en, language: { name: 'en', url: '' } },
        ],
        pokemon: [],
      });
    }

    const abilityMatch = /\/ability\/([^/]+)\/?$/.exec(path);
    if (abilityMatch !== null) {
      const key = abilityMatch[1]!;
      const a = ABILITY_NAMES[key];
      if (a === undefined) return new Response('not found', { status: 404 });
      return jsonResponse({
        id: 1,
        name: key,
        names: [
          { name: a.ja, language: { name: 'ja-Hrkt', url: '' } },
          { name: a.en, language: { name: 'en', url: '' } },
        ],
      });
    }

    const speciesMatch = /\/pokemon-species\/([^/]+)\/?$/.exec(path);
    if (speciesMatch !== null) {
      const key = speciesMatch[1]!;
      const f = FIXTURES.find((x) => x.name === key || String(x.id) === key);
      if (f === undefined) return new Response('not found', { status: 404 });
      return jsonResponse(speciesBody(f));
    }

    const pokemonMatch = /\/pokemon\/([^/]+)\/?$/.exec(path);
    if (pokemonMatch !== null) {
      const key = pokemonMatch[1]!;
      const f = FIXTURES.find((x) => x.name === key || String(x.id) === key);
      if (f === undefined) return new Response('not found', { status: 404 });
      return jsonResponse(pokemonBody(f));
    }

    return new Response('not found', { status: 404 });
  });
}

function makeClient(fetchImpl: ReturnType<typeof makeFetchImpl>): PokeApiClient {
  return new PokeApiClient({
    baseUrl: UPSTREAM,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
}

describe('fetchPokemonDetail', () => {
  it('aggregates number, name, image, types, stats, abilities and evolution into one response', async () => {
    const client = makeClient(makeFetchImpl());

    const detail = await fetchPokemonDetail(client, 'bulbasaur');

    expect(detail.id).toBe(1);
    expect(detail.name).toEqual({ ja: 'フシギダネ', en: 'Bulbasaur' });
    expect(detail.imageUrl).toBe('https://img.test/artwork/1.png');
    expect(detail.height).toBe(7);
    expect(detail.weight).toBe(69);

    expect(detail.stats).toEqual([
      { id: 'hp', base: 45 },
      { id: 'attack', base: 49 },
      { id: 'defense', base: 49 },
    ]);
  });

  it('returns proper nouns (types and abilities) in both ja and en', async () => {
    const client = makeClient(makeFetchImpl());

    const detail = await fetchPokemonDetail(client, 1);

    expect(detail.types).toEqual([
      { id: 'grass', name: { ja: 'くさ', en: 'grass' } },
      { id: 'poison', name: { ja: 'どく', en: 'poison' } },
    ]);

    expect(detail.abilities).toEqual([
      { id: 'overgrow', name: { ja: 'しんりょく', en: 'Overgrow' }, isHidden: false },
      { id: 'chlorophyll', name: { ja: 'ようりょくそ', en: 'Chlorophyll' }, isHidden: true },
    ]);
  });

  it('builds the full evolution chain tree with localized names and images', async () => {
    const client = makeClient(makeFetchImpl());

    const detail = await fetchPokemonDetail(client, 'bulbasaur');

    const root = detail.evolutionChain;
    expect(root.id).toBe(1);
    expect(root.name).toEqual({ ja: 'フシギダネ', en: 'Bulbasaur' });
    expect(root.imageUrl).toBe('https://img.test/artwork/1.png');
    expect(root.evolvesTo).toHaveLength(1);

    const stage2 = root.evolvesTo[0]!;
    expect(stage2.id).toBe(2);
    expect(stage2.name).toEqual({ ja: 'フシギソウ', en: 'Ivysaur' });
    // Ivysaur has no official artwork; falls back to front_default.
    expect(stage2.imageUrl).toBe('https://img.test/sprite/2.png');
    expect(stage2.evolvesTo).toHaveLength(1);

    const stage3 = stage2.evolvesTo[0]!;
    expect(stage3.id).toBe(3);
    expect(stage3.name).toEqual({ ja: 'フシギバナ', en: 'Venusaur' });
    expect(stage3.evolvesTo).toEqual([]);
  });

  it('resolves the species by the pokemon.species reference, not the requested key', async () => {
    const fetchImpl = makeFetchImpl();
    const client = makeClient(fetchImpl);

    await fetchPokemonDetail(client, 'bulbasaur');

    const speciesCalls = fetchImpl.mock.calls.filter((call) =>
      String(call[0]).includes('/pokemon-species/'),
    );
    // 起点 species は 1 度のみ。進化メンバー(2,3)が各 1 度ずつ。起点の重複取得をしない。
    expect(speciesCalls.length).toBe(3);
  });

  it('does not exceed the configured upstream concurrency during fan-out', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const concurrency = 2;

    const base = makeFetchImpl();
    const fetchImpl = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const path = new URL(String(input)).pathname;
      // 起点の pokemon/species/evolution-chain は逐次取得でファンアウト前なので計測から除く。
      const isFanOut = /\/type\/|\/ability\/|\/pokemon-species\/[23]\/|\/pokemon\/[23]\//.test(
        path,
      );
      if (isFanOut) {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await Promise.resolve();
      }
      try {
        return await base(input);
      } finally {
        if (isFanOut) inFlight -= 1;
      }
    });

    const client = makeClient(fetchImpl as unknown as ReturnType<typeof makeFetchImpl>);

    await fetchPokemonDetail(client, 'bulbasaur', undefined, concurrency);

    expect(maxInFlight).toBeLessThanOrEqual(concurrency);
    expect(maxInFlight).toBeGreaterThan(0);
  });

  it('falls back type/ability display names to the identifier when upstream lacks names', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const path = new URL(String(input)).pathname;
      if (/\/type\//.test(path)) {
        return jsonResponse({ id: 1, name: 'mystery', names: [], pokemon: [] });
      }
      if (/\/ability\//.test(path)) {
        return jsonResponse({ id: 1, name: 'mystery', names: [] });
      }
      if (/\/evolution-chain\//.test(path)) {
        return jsonResponse({
          id: 9,
          chain: {
            species: { name: 'loner', url: `${UPSTREAM}/pokemon-species/99/` },
            evolves_to: [],
          },
        });
      }
      if (/\/pokemon-species\//.test(path)) {
        return jsonResponse({
          id: 99,
          name: 'loner',
          names: [{ name: 'Loner', language: { name: 'en', url: '' } }],
          flavor_text_entries: [],
          generation: { name: 'generation-i', url: '' },
          evolution_chain: { url: `${UPSTREAM}/evolution-chain/9/` },
          is_legendary: false,
          is_mythical: false,
        });
      }
      return jsonResponse({
        id: 99,
        name: 'loner',
        height: 10,
        weight: 20,
        base_experience: 1,
        types: [{ slot: 1, type: { name: 'mysterytype', url: '' } }],
        stats: [{ base_stat: 1, effort: 0, stat: { name: 'hp', url: '' } }],
        abilities: [{ is_hidden: false, slot: 1, ability: { name: 'mysteryability', url: '' } }],
        sprites: { front_default: null, front_shiny: null },
        species: { name: 'loner', url: `${UPSTREAM}/pokemon-species/99/` },
      });
    });
    const client = makeClient(fetchImpl as unknown as ReturnType<typeof makeFetchImpl>);

    const detail = await fetchPokemonDetail(client, 'loner');

    expect(detail.types).toEqual([
      { id: 'mysterytype', name: { ja: 'mysterytype', en: 'mysterytype' } },
    ]);
    expect(detail.abilities).toEqual([
      {
        id: 'mysteryability',
        name: { ja: 'mysteryability', en: 'mysteryability' },
        isHidden: false,
      },
    ]);
    expect(detail.imageUrl).toBeNull();
    expect(detail.evolutionChain.id).toBe(99);
    expect(detail.evolutionChain.evolvesTo).toEqual([]);
  });
});
