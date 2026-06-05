import { describe, expect, it, vi } from 'vitest';

import { PokeApiClient } from './client.js';
import { resolveCandidates, searchPokemon } from './search.js';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

const UPSTREAM = 'https://upstream.test/api/v2';

interface Fixture {
  readonly id: number;
  readonly name: string;
  readonly jaName: string;
  readonly enName: string;
  readonly types: readonly string[];
  readonly generation: string;
}

/** 名前・タイプ・世代の交差を確かめられる小さな図鑑。 */
const FIXTURES: readonly Fixture[] = [
  {
    id: 1,
    name: 'bulbasaur',
    jaName: 'フシギダネ',
    enName: 'Bulbasaur',
    types: ['grass', 'poison'],
    generation: 'generation-i',
  },
  {
    id: 4,
    name: 'charmander',
    jaName: 'ヒトカゲ',
    enName: 'Charmander',
    types: ['fire'],
    generation: 'generation-i',
  },
  {
    id: 7,
    name: 'squirtle',
    jaName: 'ゼニガメ',
    enName: 'Squirtle',
    types: ['water'],
    generation: 'generation-i',
  },
  {
    id: 43,
    name: 'oddish',
    jaName: 'ナゾノクサ',
    enName: 'Oddish',
    types: ['grass', 'poison'],
    generation: 'generation-i',
  },
  {
    id: 152,
    name: 'chikorita',
    jaName: 'チコリータ',
    enName: 'Chikorita',
    types: ['grass'],
    generation: 'generation-ii',
  },
];

function byId(id: number): Fixture {
  const f = FIXTURES.find((x) => x.id === id);
  if (f === undefined) throw new Error(`no fixture for ${id}`);
  return f;
}

function pokemonBody(f: Fixture): unknown {
  return {
    id: f.id,
    name: f.name,
    types: f.types.map((name, index) => ({ slot: index + 1, type: { name, url: '' } })),
    sprites: {
      front_default: `https://img.test/${f.id}.png`,
      front_shiny: null,
      other: { 'official-artwork': { front_default: `https://img.test/art/${f.id}.png` } },
    },
    species: { name: f.name, url: `${UPSTREAM}/pokemon-species/${f.id}/` },
  };
}

function speciesBody(f: Fixture): unknown {
  return {
    id: f.id,
    name: f.name,
    names: [
      { name: f.jaName, language: { name: 'ja-Hrkt', url: '' } },
      { name: f.enName, language: { name: 'en', url: '' } },
    ],
    flavor_text_entries: [],
    generation: { name: f.generation, url: '' },
    evolution_chain: { url: '' },
    is_legendary: false,
    is_mythical: false,
  };
}

function makeFetchImpl() {
  return vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const url = new URL(String(input));
    const path = url.pathname;

    const typeMatch = /\/type\/([^/]+)\/?$/.exec(path);
    if (typeMatch !== null) {
      const typeName = typeMatch[1];
      const members = FIXTURES.filter((f) => f.types.includes(typeName!));
      return jsonResponse({
        id: 0,
        name: typeName,
        names: [],
        pokemon: members.map((f) => ({
          slot: 1,
          pokemon: { name: f.name, url: `${UPSTREAM}/pokemon/${f.id}/` },
        })),
      });
    }

    const genMatch = /\/generation\/([^/]+)\/?$/.exec(path);
    if (genMatch !== null) {
      const genName = genMatch[1];
      const members = FIXTURES.filter((f) => f.generation === genName);
      return jsonResponse({
        id: 0,
        name: genName,
        pokemon_species: members.map((f) => ({
          name: f.name,
          url: `${UPSTREAM}/pokemon-species/${f.id}/`,
        })),
      });
    }

    if (path.endsWith('/pokemon') || path.endsWith('/pokemon/')) {
      return jsonResponse({
        count: FIXTURES.length,
        next: null,
        previous: null,
        results: FIXTURES.map((f) => ({ name: f.name, url: `${UPSTREAM}/pokemon/${f.id}/` })),
      });
    }

    const speciesMatch = /\/pokemon-species\/(\d+)\/?$/.exec(path);
    if (speciesMatch !== null) {
      return jsonResponse(speciesBody(byId(Number(speciesMatch[1]))));
    }

    const pokemonMatch = /\/pokemon\/(\d+)\/?$/.exec(path);
    if (pokemonMatch !== null) {
      return jsonResponse(pokemonBody(byId(Number(pokemonMatch[1]))));
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

describe('searchPokemon', () => {
  it('filters by english name substring', async () => {
    const client = makeClient(makeFetchImpl());

    const result = await searchPokemon(client, { name: 'saur', limit: 20, offset: 0 });

    expect(result.results.map((r) => r.id)).toEqual([1]);
    expect(result.results[0]?.name).toEqual({ ja: 'フシギダネ', en: 'Bulbasaur' });
    expect(result.count).toBe(1);
  });

  it('filters by japanese name substring', async () => {
    const client = makeClient(makeFetchImpl());

    const result = await searchPokemon(client, { name: 'ヒトカゲ', limit: 20, offset: 0 });

    expect(result.results.map((r) => r.id)).toEqual([4]);
  });

  it('filters by english name regardless of case', async () => {
    const client = makeClient(makeFetchImpl());

    const result = await searchPokemon(client, { name: 'CHARm', limit: 20, offset: 0 });

    expect(result.results.map((r) => r.id)).toEqual([4]);
  });

  it('filters by a single type membership without fetching every pokemon', async () => {
    const fetchImpl = makeFetchImpl();
    const client = makeClient(fetchImpl);

    const result = await searchPokemon(client, { types: ['fire'], limit: 20, offset: 0 });

    expect(result.results.map((r) => r.id)).toEqual([4]);
    // 全件 `/pokemon` 一覧は引かず、type メンバー集合から候補を得ること。
    const calledFullList = fetchImpl.mock.calls.some((call) => {
      const p = new URL(String(call[0])).pathname;
      return p.endsWith('/pokemon') || p.endsWith('/pokemon/');
    });
    expect(calledFullList).toBe(false);
  });

  it('intersects multiple types with AND semantics', async () => {
    const client = makeClient(makeFetchImpl());

    const result = await searchPokemon(client, {
      types: ['grass', 'poison'],
      limit: 20,
      offset: 0,
    });

    expect(result.results.map((r) => r.id)).toEqual([1, 43]);
  });

  it('filters by generation', async () => {
    const client = makeClient(makeFetchImpl());

    const result = await searchPokemon(client, {
      generation: 'generation-ii',
      limit: 20,
      offset: 0,
    });

    expect(result.results.map((r) => r.id)).toEqual([152]);
  });

  it('combines name, type and generation conditions', async () => {
    const client = makeClient(makeFetchImpl());

    const result = await searchPokemon(client, {
      name: 'sau',
      types: ['grass'],
      generation: 'generation-i',
      limit: 20,
      offset: 0,
    });

    // grass の gen-i は bulbasaur(1)/oddish(43)。名前 "sau" は bulbasaur のみ一致。
    expect(result.results.map((r) => r.id)).toEqual([1]);
  });

  it('intersects type and generation', async () => {
    const client = makeClient(makeFetchImpl());

    const result = await searchPokemon(client, {
      types: ['grass'],
      generation: 'generation-i',
      limit: 20,
      offset: 0,
    });

    expect(result.results.map((r) => r.id)).toEqual([1, 43]);
  });

  it('paginates the filtered result set', async () => {
    const client = makeClient(makeFetchImpl());

    const page1 = await searchPokemon(client, {
      types: ['grass'],
      generation: 'generation-i',
      limit: 1,
      offset: 0,
    });
    expect(page1.results.map((r) => r.id)).toEqual([1]);
    expect(page1.count).toBe(2);
    expect(page1.nextOffset).toBe(1);

    const page2 = await searchPokemon(client, {
      types: ['grass'],
      generation: 'generation-i',
      limit: 1,
      offset: page1.nextOffset ?? 0,
    });
    expect(page2.results.map((r) => r.id)).toEqual([43]);
    expect(page2.nextOffset).toBeNull();
  });

  it('returns empty results when no candidate matches', async () => {
    const client = makeClient(makeFetchImpl());

    const result = await searchPokemon(client, {
      types: ['fire', 'water'],
      limit: 20,
      offset: 0,
    });

    expect(result.results).toEqual([]);
    expect(result.count).toBe(0);
    expect(result.nextOffset).toBeNull();
  });

  it('excludes alternate-form ids from a type filter and does not 502', async () => {
    // grass タイプのメンバーに別フォーム id (>= 10001) が混ざっても、既定フォーム id 空間に
    // 正規化されるため species 取得で 404 を引かず、結果から別フォームが除外される。
    const fetchImpl = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const path = new URL(String(input)).pathname;

      const typeMatch = /\/type\/([^/]+)\/?$/.exec(path);
      if (typeMatch !== null) {
        const members = FIXTURES.filter((f) => f.types.includes(typeMatch[1]!));
        return jsonResponse({
          id: 0,
          name: typeMatch[1],
          names: [],
          pokemon: [
            ...members.map((f) => ({
              slot: 1,
              pokemon: { name: f.name, url: `${UPSTREAM}/pokemon/${f.id}/` },
            })),
            // 別フォーム（例: メガフシギバナ相当）。species 取得は存在しない id で 404 になる。
            { slot: 1, pokemon: { name: 'venusaur-mega', url: `${UPSTREAM}/pokemon/10033/` } },
          ],
        });
      }

      const speciesMatch = /\/pokemon-species\/(\d+)\/?$/.exec(path);
      if (speciesMatch !== null) {
        const id = Number(speciesMatch[1]);
        if (!FIXTURES.some((f) => f.id === id)) {
          return new Response('not found', { status: 404 });
        }
        return jsonResponse(speciesBody(byId(id)));
      }

      const pokemonMatch = /\/pokemon\/(\d+)\/?$/.exec(path);
      if (pokemonMatch !== null) {
        const id = Number(pokemonMatch[1]);
        if (!FIXTURES.some((f) => f.id === id)) {
          return new Response('not found', { status: 404 });
        }
        return jsonResponse(pokemonBody(byId(id)));
      }

      return new Response('not found', { status: 404 });
    });
    const client = makeClient(fetchImpl as unknown as ReturnType<typeof makeFetchImpl>);

    const result = await searchPokemon(client, { types: ['grass'], limit: 20, offset: 0 });

    // grass の既定フォームのみ（1/43/152）。別フォーム 10033 は除外される。
    expect(result.results.map((r) => r.id)).toEqual([1, 43, 152]);
    expect(result.results.map((r) => r.id)).not.toContain(10033);
  });

  it('excludes alternate-form ids from a name-only full-list search without fetching them', async () => {
    // タイプ・世代が無い名前のみの検索は `/pokemon` 全件を候補にする。一覧に別フォーム id
    // (>= 10000) が混ざっても既定フォームのみへ正規化されるため、別フォームの pokemon/species は
    // 取得されず、候補上限の枠も浪費しない。
    const fetchImpl = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const path = new URL(String(input)).pathname;

      if (path.endsWith('/pokemon') || path.endsWith('/pokemon/')) {
        return jsonResponse({
          count: FIXTURES.length + 1,
          next: null,
          previous: null,
          results: [
            ...FIXTURES.map((f) => ({ name: f.name, url: `${UPSTREAM}/pokemon/${f.id}/` })),
            // 別フォーム（例: メガフシギバナ相当）。species 取得は存在しない id で 404 になる。
            { name: 'venusaur-mega', url: `${UPSTREAM}/pokemon/10033/` },
          ],
        });
      }

      const speciesMatch = /\/pokemon-species\/(\d+)\/?$/.exec(path);
      if (speciesMatch !== null) {
        return jsonResponse(speciesBody(byId(Number(speciesMatch[1]))));
      }

      const pokemonMatch = /\/pokemon\/(\d+)\/?$/.exec(path);
      if (pokemonMatch !== null) {
        return jsonResponse(pokemonBody(byId(Number(pokemonMatch[1]))));
      }

      return new Response('not found', { status: 404 });
    });
    const client = makeClient(fetchImpl as unknown as ReturnType<typeof makeFetchImpl>);

    const result = await searchPokemon(client, { name: 'a', limit: 20, offset: 0 });

    expect(result.results.map((r) => r.id)).not.toContain(10033);
    // 別フォーム id の pokemon/species は候補に乗らないため取得されない。
    const fetchedAltForm = fetchImpl.mock.calls.some((call) => {
      const p = new URL(String(call[0])).pathname;
      return /\/pokemon\/10033\/?$/.test(p) || /\/pokemon-species\/10033\/?$/.test(p);
    });
    expect(fetchedAltForm).toBe(false);
  });

  it('keeps default-form matches for a type and generation intersection', async () => {
    const client = makeClient(makeFetchImpl());

    const result = await searchPokemon(client, {
      types: ['grass', 'poison'],
      generation: 'generation-i',
      limit: 20,
      offset: 0,
    });

    // grass+poison の gen-i は bulbasaur(1)/oddish(43) の既定フォーム。
    expect(result.results.map((r) => r.id)).toEqual([1, 43]);
  });

  it('treats an unknown type as no matches instead of failing', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const path = new URL(String(input)).pathname;
      if (/\/type\/([^/]+)\/?$/.test(path)) {
        return new Response('not found', { status: 404 });
      }
      return new Response('not found', { status: 404 });
    });
    const client = makeClient(fetchImpl as unknown as ReturnType<typeof makeFetchImpl>);

    const result = await searchPokemon(client, { types: ['notatype'], limit: 20, offset: 0 });

    expect(result.results).toEqual([]);
    expect(result.count).toBe(0);
  });

  it('treats an unknown generation as no matches instead of failing', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const path = new URL(String(input)).pathname;
      if (/\/generation\/([^/]+)\/?$/.test(path)) {
        return new Response('not found', { status: 404 });
      }
      return new Response('not found', { status: 404 });
    });
    const client = makeClient(fetchImpl as unknown as ReturnType<typeof makeFetchImpl>);

    const result = await searchPokemon(client, {
      generation: 'generation-zzz',
      limit: 20,
      offset: 0,
    });

    expect(result.results).toEqual([]);
    expect(result.count).toBe(0);
  });

  it('caps in-flight upstream fetches at the configured concurrency', async () => {
    const base = makeFetchImpl();
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const path = new URL(String(input)).pathname;
      const isDetail = /\/pokemon\/\d+\/?$/.test(path) || /\/pokemon-species\/\d+\/?$/.test(path);
      if (isDetail) {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await Promise.resolve();
      }
      try {
        return await base(input);
      } finally {
        if (isDetail) inFlight -= 1;
      }
    });
    const client = makeClient(fetchImpl as unknown as ReturnType<typeof makeFetchImpl>);

    await searchPokemon(client, { name: 'a', limit: 20, offset: 0 }, undefined, 3);

    expect(maxInFlight).toBeLessThanOrEqual(3);
    expect(maxInFlight).toBeGreaterThan(0);
  });
});

describe('resolveCandidates', () => {
  it('attaches the english slug from the /pokemon list for a name-only search', async () => {
    const client = makeClient(makeFetchImpl());

    const candidates = await resolveCandidates(
      client,
      { name: 'x', limit: 20, offset: 0 },
      undefined,
    );

    expect(candidates).toEqual(FIXTURES.map((f) => ({ id: f.id, slug: f.name })));
  });

  it('attaches the english slug from /type members for a type filter', async () => {
    const client = makeClient(makeFetchImpl());

    const candidates = await resolveCandidates(
      client,
      { types: ['grass', 'poison'], limit: 20, offset: 0 },
      undefined,
    );

    // grass∩poison は bulbasaur(1)/oddish(43)。slug は type メンバーの pokemon.name から得る。
    expect(candidates).toEqual([
      { id: 1, slug: 'bulbasaur' },
      { id: 43, slug: 'oddish' },
    ]);
  });

  it('attaches the english slug from /generation pokemon_species for a generation filter', async () => {
    const client = makeClient(makeFetchImpl());

    const candidates = await resolveCandidates(
      client,
      { generation: 'generation-ii', limit: 20, offset: 0 },
      undefined,
    );

    expect(candidates).toEqual([{ id: 152, slug: 'chikorita' }]);
  });

  it('attaches slugs for a type and generation intersection', async () => {
    const client = makeClient(makeFetchImpl());

    const candidates = await resolveCandidates(
      client,
      { types: ['grass'], generation: 'generation-i', limit: 20, offset: 0 },
      undefined,
    );

    expect(candidates).toEqual([
      { id: 1, slug: 'bulbasaur' },
      { id: 43, slug: 'oddish' },
    ]);
  });
});
