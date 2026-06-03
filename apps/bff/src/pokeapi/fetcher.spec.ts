import { describe, expect, it, vi } from 'vitest';

import { PokeApiError } from './errors.js';
import { fetchJson } from './fetcher.js';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('fetchJson', () => {
  it('returns parsed JSON on success', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: 25, name: 'pikachu' }));

    const result = await fetchJson<{ id: number; name: string }>(
      'https://example.test/pokemon/25',
      {
        timeoutMs: 1000,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
    );

    expect(result).toEqual({ id: 25, name: 'pikachu' });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('throws an http PokeApiError on non-2xx responses', async () => {
    const fetchImpl = vi.fn(async () => new Response('not found', { status: 404 }));

    const error = await fetchJson('https://example.test/pokemon/0', {
      timeoutMs: 1000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PokeApiError);
    expect((error as PokeApiError).kind).toBe('http');
    expect((error as PokeApiError).status).toBe(404);
    expect((error as PokeApiError).isUpstreamFailure).toBe(false);
  });

  it('classifies 5xx as an upstream failure', async () => {
    const fetchImpl = vi.fn(async () => new Response('boom', { status: 503 }));

    const error = (await fetchJson('https://example.test/pokemon/1', {
      timeoutMs: 1000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    }).catch((e: unknown) => e)) as PokeApiError;

    expect(error.kind).toBe('http');
    expect(error.isUpstreamFailure).toBe(true);
  });

  it('throws a network PokeApiError when fetch rejects', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });

    const error = (await fetchJson('https://example.test/pokemon/1', {
      timeoutMs: 1000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    }).catch((e: unknown) => e)) as PokeApiError;

    expect(error.kind).toBe('network');
    expect(error.isUpstreamFailure).toBe(true);
  });

  it('throws a timeout PokeApiError when the request exceeds the timeout', async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        }),
    );

    const error = (await fetchJson('https://example.test/slow', {
      timeoutMs: 5,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    }).catch((e: unknown) => e)) as PokeApiError;

    expect(error.kind).toBe('timeout');
    expect(error.isUpstreamFailure).toBe(true);
  });

  it('throws a parse PokeApiError on invalid JSON', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response('<<<not json>>>', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );

    const error = (await fetchJson('https://example.test/pokemon/1', {
      timeoutMs: 1000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    }).catch((e: unknown) => e)) as PokeApiError;

    expect(error.kind).toBe('parse');
  });
});
