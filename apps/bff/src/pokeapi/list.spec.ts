import { describe, expect, it, vi } from 'vitest';

import { PokeApiClient } from './client.js';
import { extractIdFromResourceUrl, fetchPokemonList, mapWithConcurrency } from './list.js';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

const UPSTREAM = 'https://upstream.test/api/v2';

interface UpstreamFixture {
  readonly id: number;
  readonly name: string;
  readonly jaName: string;
  readonly enName: string;
  readonly types: readonly string[];
  readonly artwork?: string | null;
  readonly frontDefault?: string | null;
}

const BULBASAUR: UpstreamFixture = {
  id: 1,
  name: 'bulbasaur',
  jaName: 'フシギダネ',
  enName: 'Bulbasaur',
  types: ['grass', 'poison'],
  artwork: 'https://img.test/artwork/1.png',
  frontDefault: 'https://img.test/sprite/1.png',
};

const IVYSAUR: UpstreamFixture = {
  id: 2,
  name: 'ivysaur',
  jaName: 'フシギソウ',
  enName: 'Ivysaur',
  types: ['grass', 'poison'],
  artwork: null,
  frontDefault: 'https://img.test/sprite/2.png',
};

function pokemonBody(f: UpstreamFixture): unknown {
  return {
    id: f.id,
    name: f.name,
    types: f.types.map((name, index) => ({ slot: index + 1, type: { name, url: '' } })),
    sprites: {
      front_default: f.frontDefault ?? null,
      front_shiny: null,
      other: { 'official-artwork': { front_default: f.artwork ?? null } },
    },
    species: { name: f.name, url: `${UPSTREAM}/pokemon-species/${f.id}/` },
  };
}

function speciesBody(f: UpstreamFixture): unknown {
  return {
    id: f.id,
    name: f.name,
    names: [
      { name: f.jaName, language: { name: 'ja-Hrkt', url: '' } },
      { name: f.enName, language: { name: 'en', url: '' } },
    ],
    flavor_text_entries: [],
    generation: { name: 'generation-i', url: '' },
    evolution_chain: { url: '' },
    is_legendary: false,
    is_mythical: false,
  };
}

/** offset/limit と件数からモック上流を組み立てる。 */
function makeFetchImpl(fixtures: readonly UpstreamFixture[], total: number) {
  return vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const url = new URL(String(input));
    const path = url.pathname;

    if (path.endsWith('/pokemon') || path.endsWith('/pokemon/')) {
      const limit = Number(url.searchParams.get('limit'));
      const offset = Number(url.searchParams.get('offset'));
      const slice = fixtures.slice(offset, offset + limit);
      const hasNext = offset + limit < total;
      return jsonResponse({
        count: total,
        next: hasNext ? `${UPSTREAM}/pokemon?offset=${offset + limit}&limit=${limit}` : null,
        previous: null,
        results: slice.map((f) => ({ name: f.name, url: `${UPSTREAM}/pokemon/${f.id}/` })),
      });
    }

    const speciesMatch = /\/pokemon-species\/(\d+)\/?$/.exec(path);
    if (speciesMatch !== null) {
      const id = Number(speciesMatch[1]);
      const f = fixtures.find((x) => x.id === id);
      if (f === undefined) return new Response('not found', { status: 404 });
      return jsonResponse(speciesBody(f));
    }

    const pokemonMatch = /\/pokemon\/(\d+)\/?$/.exec(path);
    if (pokemonMatch !== null) {
      const id = Number(pokemonMatch[1]);
      const f = fixtures.find((x) => x.id === id);
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

describe('extractIdFromResourceUrl', () => {
  it('extracts the trailing numeric id', () => {
    expect(extractIdFromResourceUrl(`${UPSTREAM}/pokemon/25/`)).toBe(25);
    expect(extractIdFromResourceUrl(`${UPSTREAM}/pokemon/25`)).toBe(25);
  });

  it('throws when no id is present', () => {
    expect(() => extractIdFromResourceUrl(`${UPSTREAM}/pokemon/`)).toThrow();
  });
});

describe('fetchPokemonList', () => {
  it('returns each item with number, image, multilingual name and types', async () => {
    const client = makeClient(makeFetchImpl([BULBASAUR, IVYSAUR], 2));

    const result = await fetchPokemonList(client, { limit: 20, offset: 0 });

    expect(result.count).toBe(2);
    expect(result.offset).toBe(0);
    expect(result.limit).toBe(20);
    expect(result.results).toHaveLength(2);

    const first = result.results[0];
    expect(first?.id).toBe(1);
    expect(first?.imageUrl).toBe('https://img.test/artwork/1.png');
    expect(first?.name).toEqual({ ja: 'フシギダネ', en: 'Bulbasaur' });
    expect(first?.types).toEqual(['grass', 'poison']);
  });

  it('falls back to front_default when official artwork is missing', async () => {
    const client = makeClient(makeFetchImpl([IVYSAUR], 1));

    const result = await fetchPokemonList(client, { limit: 20, offset: 0 });

    expect(result.results[0]?.imageUrl).toBe('https://img.test/sprite/2.png');
  });

  it('exposes nextOffset for infinite scroll and supports loading the next page', async () => {
    const fixtures: UpstreamFixture[] = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      name: `mon-${i + 1}`,
      jaName: `名前-${i + 1}`,
      enName: `Mon-${i + 1}`,
      types: ['normal'],
      artwork: `https://img.test/artwork/${i + 1}.png`,
      frontDefault: null,
    }));
    const client = makeClient(makeFetchImpl(fixtures, 5));

    const page1 = await fetchPokemonList(client, { limit: 2, offset: 0 });
    expect(page1.results.map((r) => r.id)).toEqual([1, 2]);
    expect(page1.nextOffset).toBe(2);

    const page2 = await fetchPokemonList(client, { limit: 2, offset: page1.nextOffset ?? 0 });
    expect(page2.results.map((r) => r.id)).toEqual([3, 4]);
    expect(page2.nextOffset).toBe(4);
  });

  it('returns nextOffset null on the final page', async () => {
    const client = makeClient(makeFetchImpl([BULBASAUR, IVYSAUR], 2));

    const result = await fetchPokemonList(client, { limit: 20, offset: 0 });

    expect(result.nextOffset).toBeNull();
  });

  it('falls back ja name to en when no japanese name exists', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = new URL(String(input));
      const path = url.pathname;
      if (path.endsWith('/pokemon')) {
        return jsonResponse({
          count: 1,
          next: null,
          previous: null,
          results: [{ name: 'porygon', url: `${UPSTREAM}/pokemon/137/` }],
        });
      }
      if (/\/pokemon-species\//.test(path)) {
        return jsonResponse({
          id: 137,
          name: 'porygon',
          names: [{ name: 'Porygon', language: { name: 'en', url: '' } }],
          flavor_text_entries: [],
          generation: { name: 'generation-i', url: '' },
          evolution_chain: { url: '' },
          is_legendary: false,
          is_mythical: false,
        });
      }
      return jsonResponse(
        pokemonBody({ id: 137, name: 'porygon', jaName: '', enName: 'Porygon', types: ['normal'] }),
      );
    });
    const client = makeClient(fetchImpl as unknown as ReturnType<typeof makeFetchImpl>);

    const result = await fetchPokemonList(client, { limit: 20, offset: 0 });

    expect(result.results[0]?.name).toEqual({ ja: 'Porygon', en: 'Porygon' });
  });

  it('never runs more upstream detail fetches concurrently than the configured limit', async () => {
    const total = 50;
    const concurrency = 4;
    const fixtures: UpstreamFixture[] = Array.from({ length: total }, (_, i) => ({
      id: i + 1,
      name: `mon-${i + 1}`,
      jaName: `名前-${i + 1}`,
      enName: `Mon-${i + 1}`,
      types: ['normal'],
      artwork: `https://img.test/artwork/${i + 1}.png`,
      frontDefault: null,
    }));

    let inFlight = 0;
    let maxInFlight = 0;

    const base = makeFetchImpl(fixtures, total);
    const fetchImpl = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const path = new URL(String(input)).pathname;
      // 一覧（/pokemon）自体はファンアウト前の単発リクエストなので計測対象から除く。
      const isDetail = !(path.endsWith('/pokemon') || path.endsWith('/pokemon/'));

      if (isDetail) {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        // 同時実行が確実に重なるよう、解決をマイクロタスク 1 周ぶん遅らせる。
        await Promise.resolve();
      }
      try {
        return await base(input);
      } finally {
        if (isDetail) {
          inFlight -= 1;
        }
      }
    });

    const client = makeClient(fetchImpl as unknown as ReturnType<typeof makeFetchImpl>);

    const result = await fetchPokemonList(
      client,
      { limit: total, offset: 0 },
      undefined,
      concurrency,
    );

    expect(result.results).toHaveLength(total);
    expect(maxInFlight).toBeLessThanOrEqual(concurrency);
    expect(maxInFlight).toBeGreaterThan(0);
  });
});

describe('mapWithConcurrency', () => {
  it('preserves input order in the results', async () => {
    const items = [10, 20, 30, 40, 50];

    const result = await mapWithConcurrency(items, 2, async (value) => {
      await Promise.resolve();
      return value * 2;
    });

    expect(result).toEqual([20, 40, 60, 80, 100]);
  });

  it('caps the number of in-flight mapper calls at the concurrency limit', async () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const concurrency = 3;
    let inFlight = 0;
    let maxInFlight = 0;

    await mapWithConcurrency(items, concurrency, async (value) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return value;
    });

    expect(maxInFlight).toBeLessThanOrEqual(concurrency);
    expect(maxInFlight).toBe(concurrency);
  });
});
