import { describe, expect, it, vi } from 'vitest';

import { PokeApiClient, buildCacheKey } from './client.js';
import { PokeApiError } from './errors.js';
import type { PokeApiPokemon } from './types.js';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

function clock(start = 0) {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

const pikachu = { id: 25, name: 'pikachu' } as unknown as PokeApiPokemon;

describe('buildCacheKey', () => {
  it('normalizes leading/trailing slashes', () => {
    expect(buildCacheKey('/pokemon/25/')).toBe('pokemon/25');
  });

  it('produces a stable key regardless of query order', () => {
    const a = buildCacheKey('pokemon', { offset: 20, limit: 20 });
    const b = buildCacheKey('pokemon', { limit: 20, offset: 20 });
    expect(a).toBe(b);
    expect(a).toBe('pokemon?limit=20&offset=20');
  });
});

describe('PokeApiClient', () => {
  it('fetches a resource through the configured base URL', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(pikachu));
    const client = new PokeApiClient({
      baseUrl: 'https://upstream.test/api/v2/',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await client.fetchPokemon(25);

    expect(result).toEqual(pikachu);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://upstream.test/api/v2/pokemon/25');
  });

  it('serves identical requests from cache within the TTL', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(pikachu));
    const client = new PokeApiClient({
      ttlMs: 1000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await client.fetchPokemon(25);
    await client.fetchPokemon(25);

    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('re-fetches once the TTL elapses', async () => {
    const time = clock();
    const fetchImpl = vi.fn(async () => jsonResponse(pikachu));
    const client = new PokeApiClient({
      ttlMs: 1000,
      staleMs: 0,
      now: time.now,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await client.fetchPokemon(25);
    time.advance(1000);
    await client.fetchPokemon(25);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('bypasses the cache when forceRefresh is set', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(pikachu));
    const client = new PokeApiClient({
      ttlMs: 100_000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await client.fetchPokemon(25);
    await client.fetchPokemon(25, { forceRefresh: true });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('falls back to a stale cache entry on upstream failure', async () => {
    const time = clock();
    let mode: 'ok' | 'fail' = 'ok';
    const fetchImpl = vi.fn(async () => {
      if (mode === 'fail') {
        return new Response('down', { status: 503 });
      }
      return jsonResponse(pikachu);
    });
    const client = new PokeApiClient({
      ttlMs: 1000,
      staleMs: 10_000,
      now: time.now,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await client.fetchPokemon(25);

    // TTL is past, so a refetch is attempted, but the upstream is now failing.
    time.advance(2000);
    mode = 'fail';

    const result = await client.fetchPokemon(25);
    expect(result).toEqual(pikachu);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not fall back to stale on a 404 client error', async () => {
    const time = clock();
    let mode: 'ok' | 'missing' = 'ok';
    const fetchImpl = vi.fn(async () => {
      if (mode === 'missing') {
        return new Response('not found', { status: 404 });
      }
      return jsonResponse(pikachu);
    });
    const client = new PokeApiClient({
      ttlMs: 1000,
      staleMs: 10_000,
      now: time.now,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await client.fetchPokemon(25);
    time.advance(2000);
    mode = 'missing';

    const error = (await client.fetchPokemon(25).catch((e: unknown) => e)) as PokeApiError;
    expect(error).toBeInstanceOf(PokeApiError);
    expect(error.kind).toBe('http');
    expect(error.status).toBe(404);
  });

  it('propagates the error when no cache exists to fall back to', async () => {
    const fetchImpl = vi.fn(async () => new Response('down', { status: 503 }));
    const client = new PokeApiClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const error = (await client.fetchPokemon(25).catch((e: unknown) => e)) as PokeApiError;
    expect(error).toBeInstanceOf(PokeApiError);
    expect(error.isUpstreamFailure).toBe(true);
  });

  it('passes pagination params as query string for list requests', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ count: 0, next: null, previous: null, results: [] }),
    );
    const client = new PokeApiClient({
      baseUrl: 'https://upstream.test/api/v2',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await client.fetchPokemonList({ limit: 20, offset: 40 });

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      'https://upstream.test/api/v2/pokemon?limit=20&offset=40',
    );
  });
});
