import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { PokeApiClient } from '../pokeapi/index.js';
import type { PokemonListResponse } from '../pokeapi/index.js';
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
});
