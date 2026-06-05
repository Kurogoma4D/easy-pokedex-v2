import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { PokeApiClient } from '../pokeapi/index.js';
import type {
  PokemonDetail,
  PokemonListResponse,
  PokemonSearchResponse,
} from '../pokeapi/index.js';
import { createPokemonRoutes } from './pokemon.js';

const UPSTREAM = 'https://upstream.test/api/v2';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

const TOTAL = 3;

/** id=1..3 の小さなモック上流。 */
function makeFetchImpl() {
  return vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const url = new URL(String(input));
    const path = url.pathname;

    if (path.endsWith('/pokemon')) {
      const limit = Number(url.searchParams.get('limit'));
      const offset = Number(url.searchParams.get('offset'));
      const ids = [1, 2, 3].slice(offset, offset + limit);
      const hasNext = offset + limit < TOTAL;
      return jsonResponse({
        count: TOTAL,
        next: hasNext ? `${UPSTREAM}/pokemon?offset=${offset + limit}&limit=${limit}` : null,
        previous: null,
        results: ids.map((id) => ({ name: `mon-${id}`, url: `${UPSTREAM}/pokemon/${id}/` })),
      });
    }

    const speciesMatch = /\/pokemon-species\/(\d+)\/?$/.exec(path);
    if (speciesMatch !== null) {
      const id = Number(speciesMatch[1]);
      return jsonResponse({
        id,
        name: `mon-${id}`,
        names: [
          { name: `なまえ-${id}`, language: { name: 'ja-Hrkt', url: '' } },
          { name: `Mon-${id}`, language: { name: 'en', url: '' } },
        ],
        flavor_text_entries: [],
        generation: { name: 'generation-i', url: '' },
        evolution_chain: { url: '' },
        is_legendary: false,
        is_mythical: false,
      });
    }

    const pokemonMatch = /\/pokemon\/(\d+)\/?$/.exec(path);
    if (pokemonMatch !== null) {
      const id = Number(pokemonMatch[1]);
      return jsonResponse({
        id,
        name: `mon-${id}`,
        types: [{ slot: 1, type: { name: 'normal', url: '' } }],
        sprites: {
          front_default: `https://img.test/${id}.png`,
          front_shiny: null,
          other: { 'official-artwork': { front_default: `https://img.test/art/${id}.png` } },
        },
        species: { name: `mon-${id}`, url: `${UPSTREAM}/pokemon-species/${id}/` },
      });
    }

    return new Response('not found', { status: 404 });
  });
}

function makeApp(fetchImpl: ReturnType<typeof makeFetchImpl>): Hono {
  const client = new PokeApiClient({
    baseUrl: UPSTREAM,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  const app = new Hono();
  app.route('/pokemon', createPokemonRoutes(client));
  return app;
}

describe('GET /pokemon/list', () => {
  it('returns a paginated list with default params', async () => {
    const app = makeApp(makeFetchImpl());

    const res = await app.request('/pokemon/list');
    expect(res.status).toBe(200);

    const body = (await res.json()) as PokemonListResponse;
    expect(body.count).toBe(TOTAL);
    expect(body.offset).toBe(0);
    expect(body.limit).toBe(20);
    expect(body.nextOffset).toBeNull();
    expect(body.results).toHaveLength(3);

    const first = body.results[0];
    expect(first?.id).toBe(1);
    expect(first?.imageUrl).toBe('https://img.test/art/1.png');
    expect(first?.name).toEqual({ ja: 'なまえ-1', en: 'Mon-1' });
    expect(first?.types).toEqual(['normal']);
  });

  it('honors limit/offset and reports the next page offset', async () => {
    const app = makeApp(makeFetchImpl());

    const res = await app.request('/pokemon/list?limit=2&offset=0');
    expect(res.status).toBe(200);

    const body = (await res.json()) as PokemonListResponse;
    expect(body.results.map((r) => r.id)).toEqual([1, 2]);
    expect(body.nextOffset).toBe(2);

    const next = await app.request(`/pokemon/list?limit=2&offset=${body.nextOffset ?? 0}`);
    const nextBody = (await next.json()) as PokemonListResponse;
    expect(nextBody.results.map((r) => r.id)).toEqual([3]);
    expect(nextBody.nextOffset).toBeNull();
  });

  it('rejects invalid pagination params with 400', async () => {
    const app = makeApp(makeFetchImpl());

    expect((await app.request('/pokemon/list?limit=-1')).status).toBe(400);
    expect((await app.request('/pokemon/list?limit=abc')).status).toBe(400);
    expect((await app.request('/pokemon/list?offset=1.5')).status).toBe(400);
    expect((await app.request('/pokemon/list?limit=0')).status).toBe(400);
    expect((await app.request('/pokemon/list?limit=1000')).status).toBe(400);
  });

  it('maps upstream 404 to a 404 response', async () => {
    const fetchImpl = vi.fn(async () => new Response('not found', { status: 404 }));
    const client = new PokeApiClient({
      baseUrl: UPSTREAM,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const app = new Hono();
    app.route('/pokemon', createPokemonRoutes(client));

    const res = await app.request('/pokemon/list');
    expect(res.status).toBe(404);
  });

  it('maps an upstream 5xx to a 502 response', async () => {
    const fetchImpl = vi.fn(async () => new Response('upstream exploded', { status: 500 }));
    const client = new PokeApiClient({
      baseUrl: UPSTREAM,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const app = new Hono();
    app.route('/pokemon', createPokemonRoutes(client));

    const res = await app.request('/pokemon/list');
    expect(res.status).toBe(502);
  });

  it('maps an upstream network failure to a 502 response', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('network down');
    });
    const client = new PokeApiClient({
      baseUrl: UPSTREAM,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const app = new Hono();
    app.route('/pokemon', createPokemonRoutes(client));

    const res = await app.request('/pokemon/list');
    expect(res.status).toBe(502);
  });
});

/** id=25(Pikachu) を単独で返すモック上流（進化なしの単一ノード）。 */
function makeDetailFetchImpl() {
  return vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const path = new URL(String(input)).pathname;

    if (/\/evolution-chain\/\d+\/?$/.test(path)) {
      return jsonResponse({
        id: 10,
        chain: {
          species: { name: 'pikachu', url: `${UPSTREAM}/pokemon-species/25/` },
          evolves_to: [],
        },
      });
    }

    const typeMatch = /\/type\/([^/]+)\/?$/.exec(path);
    if (typeMatch !== null) {
      return jsonResponse({
        id: 1,
        name: typeMatch[1],
        names: [
          { name: 'でんき', language: { name: 'ja-Hrkt', url: '' } },
          { name: 'electric', language: { name: 'en', url: '' } },
        ],
        damage_relations: {
          double_damage_from: [{ name: 'ground', url: '' }],
          half_damage_from: [{ name: 'flying', url: '' }],
          no_damage_from: [],
        },
        pokemon: [],
      });
    }

    const abilityMatch = /\/ability\/([^/]+)\/?$/.exec(path);
    if (abilityMatch !== null) {
      return jsonResponse({
        id: 1,
        name: abilityMatch[1],
        names: [
          { name: 'せいでんき', language: { name: 'ja-Hrkt', url: '' } },
          { name: 'Static', language: { name: 'en', url: '' } },
        ],
      });
    }

    if (/\/pokemon-species\//.test(path)) {
      return jsonResponse({
        id: 25,
        name: 'pikachu',
        names: [
          { name: 'ピカチュウ', language: { name: 'ja-Hrkt', url: '' } },
          { name: 'Pikachu', language: { name: 'en', url: '' } },
        ],
        flavor_text_entries: [],
        generation: { name: 'generation-i', url: '' },
        evolution_chain: { url: `${UPSTREAM}/evolution-chain/10/` },
        is_legendary: false,
        is_mythical: false,
      });
    }

    if (/\/pokemon\//.test(path)) {
      return jsonResponse({
        id: 25,
        name: 'pikachu',
        height: 4,
        weight: 60,
        base_experience: 112,
        types: [{ slot: 1, type: { name: 'electric', url: '' } }],
        stats: [{ base_stat: 35, effort: 0, stat: { name: 'hp', url: '' } }],
        abilities: [{ is_hidden: false, slot: 1, ability: { name: 'static', url: '' } }],
        sprites: {
          front_default: 'https://img.test/25.png',
          front_shiny: null,
          other: { 'official-artwork': { front_default: 'https://img.test/art/25.png' } },
        },
        species: { name: 'pikachu', url: `${UPSTREAM}/pokemon-species/25/` },
      });
    }

    return new Response('not found', { status: 404 });
  });
}

describe('GET /pokemon/:idOrName', () => {
  it('returns the aggregated detail with ja/en proper nouns in one response', async () => {
    const app = makeApp(makeDetailFetchImpl());

    const res = await app.request('/pokemon/pikachu');
    expect(res.status).toBe(200);

    const body = (await res.json()) as PokemonDetail;
    expect(body.id).toBe(25);
    expect(body.name).toEqual({ ja: 'ピカチュウ', en: 'Pikachu' });
    expect(body.imageUrl).toBe('https://img.test/art/25.png');
    expect(body.types).toEqual([{ id: 'electric', name: { ja: 'でんき', en: 'electric' } }]);
    expect(body.stats).toEqual([{ id: 'hp', base: 35 }]);
    expect(body.abilities).toEqual([
      { id: 'static', name: { ja: 'せいでんき', en: 'Static' }, isHidden: false },
    ]);
    expect(body.evolutionChain.id).toBe(25);
    expect(body.evolutionChain.evolvesTo).toEqual([]);
  });

  it('resolves detail by numeric id as well', async () => {
    const app = makeApp(makeDetailFetchImpl());

    const res = await app.request('/pokemon/25');
    expect(res.status).toBe(200);

    const body = (await res.json()) as PokemonDetail;
    expect(body.id).toBe(25);
  });

  it('does not shadow the static /list route', async () => {
    const app = makeApp(makeFetchImpl());

    const res = await app.request('/pokemon/list');
    expect(res.status).toBe(200);
    const body = (await res.json()) as PokemonListResponse;
    expect(body.results.length).toBeGreaterThan(0);
  });

  it('maps an upstream 404 to a 404 response', async () => {
    const fetchImpl = vi.fn(async () => new Response('not found', { status: 404 }));
    const app = makeApp(fetchImpl as unknown as ReturnType<typeof makeDetailFetchImpl>);

    const res = await app.request('/pokemon/missingno');
    expect(res.status).toBe(404);
  });

  it('maps an upstream 5xx to a 502 response', async () => {
    const fetchImpl = vi.fn(async () => new Response('boom', { status: 500 }));
    const app = makeApp(fetchImpl as unknown as ReturnType<typeof makeDetailFetchImpl>);

    const res = await app.request('/pokemon/pikachu');
    expect(res.status).toBe(502);
  });
});

interface SearchFixture {
  readonly id: number;
  readonly name: string;
  readonly jaName: string;
  readonly enName: string;
  readonly types: readonly string[];
  readonly generation: string;
}

const SEARCH_FIXTURES: readonly SearchFixture[] = [
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

function searchFixture(id: number): SearchFixture {
  const f = SEARCH_FIXTURES.find((x) => x.id === id);
  if (f === undefined) throw new Error(`no fixture for ${id}`);
  return f;
}

function makeSearchFetchImpl() {
  return vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const path = new URL(String(input)).pathname;

    const typeMatch = /\/type\/([^/]+)\/?$/.exec(path);
    if (typeMatch !== null) {
      const members = SEARCH_FIXTURES.filter((f) => f.types.includes(typeMatch[1]!));
      return jsonResponse({
        id: 0,
        name: typeMatch[1],
        names: [],
        pokemon: members.map((f) => ({
          slot: 1,
          pokemon: { name: f.name, url: `${UPSTREAM}/pokemon/${f.id}/` },
        })),
      });
    }

    const genMatch = /\/generation\/([^/]+)\/?$/.exec(path);
    if (genMatch !== null) {
      const members = SEARCH_FIXTURES.filter((f) => f.generation === genMatch[1]);
      return jsonResponse({
        id: 0,
        name: genMatch[1],
        pokemon_species: members.map((f) => ({
          name: f.name,
          url: `${UPSTREAM}/pokemon-species/${f.id}/`,
        })),
      });
    }

    if (path.endsWith('/pokemon') || path.endsWith('/pokemon/')) {
      return jsonResponse({
        count: SEARCH_FIXTURES.length,
        next: null,
        previous: null,
        results: SEARCH_FIXTURES.map((f) => ({
          name: f.name,
          url: `${UPSTREAM}/pokemon/${f.id}/`,
        })),
      });
    }

    const speciesMatch = /\/pokemon-species\/(\d+)\/?$/.exec(path);
    if (speciesMatch !== null) {
      const f = searchFixture(Number(speciesMatch[1]));
      return jsonResponse({
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
      });
    }

    const pokemonMatch = /\/pokemon\/(\d+)\/?$/.exec(path);
    if (pokemonMatch !== null) {
      const f = searchFixture(Number(pokemonMatch[1]));
      return jsonResponse({
        id: f.id,
        name: f.name,
        types: f.types.map((name, index) => ({ slot: index + 1, type: { name, url: '' } })),
        sprites: {
          front_default: `https://img.test/${f.id}.png`,
          front_shiny: null,
          other: { 'official-artwork': { front_default: `https://img.test/art/${f.id}.png` } },
        },
        species: { name: f.name, url: `${UPSTREAM}/pokemon-species/${f.id}/` },
      });
    }

    return new Response('not found', { status: 404 });
  });
}

describe('GET /pokemon/search', () => {
  it('is not shadowed by the dynamic /:idOrName route', async () => {
    const app = makeApp(makeSearchFetchImpl() as unknown as ReturnType<typeof makeFetchImpl>);

    const res = await app.request('/pokemon/search?name=bulba');
    expect(res.status).toBe(200);
    const body = (await res.json()) as PokemonSearchResponse;
    expect(body.results.map((r) => r.id)).toEqual([1]);
  });

  it('filters by name (ja) and returns list-shaped items', async () => {
    const app = makeApp(makeSearchFetchImpl() as unknown as ReturnType<typeof makeFetchImpl>);

    const res = await app.request('/pokemon/search?name=ヒトカゲ');
    const body = (await res.json()) as PokemonSearchResponse;
    expect(body.results).toHaveLength(1);
    expect(body.results[0]?.id).toBe(4);
    expect(body.results[0]?.name).toEqual({ ja: 'ヒトカゲ', en: 'Charmander' });
    expect(body.results[0]?.types).toEqual(['fire']);
  });

  it('applies multiple type filters with AND semantics', async () => {
    const app = makeApp(makeSearchFetchImpl() as unknown as ReturnType<typeof makeFetchImpl>);

    const res = await app.request('/pokemon/search?type=grass&type=poison');
    const body = (await res.json()) as PokemonSearchResponse;
    expect(body.results.map((r) => r.id)).toEqual([1, 43]);
  });

  it('combines name, type and generation filters', async () => {
    const app = makeApp(makeSearchFetchImpl() as unknown as ReturnType<typeof makeFetchImpl>);

    const res = await app.request('/pokemon/search?name=sau&type=grass&generation=generation-i');
    const body = (await res.json()) as PokemonSearchResponse;
    expect(body.results.map((r) => r.id)).toEqual([1]);
  });

  it('rejects invalid pagination params with 400', async () => {
    const app = makeApp(makeSearchFetchImpl() as unknown as ReturnType<typeof makeFetchImpl>);

    expect((await app.request('/pokemon/search?limit=0')).status).toBe(400);
    expect((await app.request('/pokemon/search?offset=abc')).status).toBe(400);
  });

  it('maps an upstream 5xx to a 502 response', async () => {
    const fetchImpl = vi.fn(async () => new Response('boom', { status: 500 }));
    const app = makeApp(fetchImpl as unknown as ReturnType<typeof makeFetchImpl>);

    const res = await app.request('/pokemon/search?type=grass');
    expect(res.status).toBe(502);
  });

  it('treats an unknown type as empty results with 200, not 404', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const path = new URL(String(input)).pathname;
      if (/\/type\/([^/]+)\/?$/.test(path)) {
        return new Response('not found', { status: 404 });
      }
      return new Response('not found', { status: 404 });
    });
    const app = makeApp(fetchImpl as unknown as ReturnType<typeof makeFetchImpl>);

    const res = await app.request('/pokemon/search?type=notatype');
    expect(res.status).toBe(200);
    const body = (await res.json()) as PokemonSearchResponse;
    expect(body.results).toEqual([]);
    expect(body.count).toBe(0);
  });

  it('rejects too many type params with 400', async () => {
    const app = makeApp(makeSearchFetchImpl() as unknown as ReturnType<typeof makeFetchImpl>);

    const query = ['grass', 'poison', 'fire', 'water', 'electric', 'ice']
      .map((t) => `type=${t}`)
      .join('&');
    const res = await app.request(`/pokemon/search?${query}`);
    expect(res.status).toBe(400);
  });

  it('rejects a malformed generation param with 400', async () => {
    const app = makeApp(makeSearchFetchImpl() as unknown as ReturnType<typeof makeFetchImpl>);

    const res = await app.request('/pokemon/search?generation=not a generation');
    expect(res.status).toBe(400);
  });

  it('hits a name-only search on a cold cache (no prior filter) for ja and en', async () => {
    for (const [query, expectedId, expectedName] of [
      ['ヒトカゲ', 4, { ja: 'ヒトカゲ', en: 'Charmander' }],
      ['Charmander', 4, { ja: 'ヒトカゲ', en: 'Charmander' }],
    ] as const) {
      const fetchImpl = makeSearchFetchImpl();
      const app = makeApp(fetchImpl as unknown as ReturnType<typeof makeFetchImpl>);

      const res = await app.request(`/pokemon/search?name=${encodeURIComponent(query)}`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as PokemonSearchResponse;
      expect(body.results.map((r) => r.id)).toEqual([expectedId]);
      expect(body.results[0]?.name).toEqual(expectedName);

      // マッチ判定は species のみで行うため、`/pokemon` はマッチした id でだけ引かれる。
      const fetchedPokemonIds = fetchImpl.mock.calls
        .map((call) => /\/pokemon\/(\d+)\/?$/.exec(new URL(String(call[0])).pathname))
        .filter((m): m is RegExpExecArray => m !== null)
        .map((m) => Number(m[1]));
      expect(fetchedPokemonIds).toEqual([expectedId]);
    }
  });

  it('returns the same name-only result regardless of a preceding filter pass', async () => {
    // 状態非依存: コールドキャッシュの直接検索と、先行フィルタでキャッシュを温めた後の検索が一致する。
    const coldApp = makeApp(makeSearchFetchImpl() as unknown as ReturnType<typeof makeFetchImpl>);
    const coldRes = await coldApp.request('/pokemon/search?name=ヒトカゲ');
    const cold = (await coldRes.json()) as PokemonSearchResponse;

    const warmApp = makeApp(makeSearchFetchImpl() as unknown as ReturnType<typeof makeFetchImpl>);
    // 先にタイプフィルタを通して個別 pokemon/species をキャッシュへ温める。
    await warmApp.request('/pokemon/search?type=fire');
    const warmRes = await warmApp.request('/pokemon/search?name=ヒトカゲ');
    const warm = (await warmRes.json()) as PokemonSearchResponse;

    expect(warm).toEqual(cold);
    expect(cold.results.map((r) => r.id)).toEqual([4]);
  });
});
