import { describe, expect, it } from 'vitest';

import { TtlCache } from './cache.js';

function clock(start = 0) {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

describe('TtlCache', () => {
  it('returns fresh values within the TTL', () => {
    const time = clock();
    const cache = new TtlCache<number>({ ttlMs: 1000, now: time.now });

    cache.set('a', 42);
    expect(cache.getFresh('a')).toBe(42);

    time.advance(999);
    expect(cache.getFresh('a')).toBe(42);
  });

  it('treats values as stale once the TTL elapses', () => {
    const time = clock();
    const cache = new TtlCache<number>({ ttlMs: 1000, staleMs: 5000, now: time.now });

    cache.set('a', 42);
    time.advance(1000);

    expect(cache.getFresh('a')).toBeUndefined();
    expect(cache.getStale('a')).toBe(42);

    const lookup = cache.get('a');
    expect(lookup).toEqual({ value: 42, fresh: false });
  });

  it('discards values after TTL + stale window', () => {
    const time = clock();
    const cache = new TtlCache<number>({ ttlMs: 1000, staleMs: 5000, now: time.now });

    cache.set('a', 42);
    time.advance(6000);

    expect(cache.getStale('a')).toBeUndefined();
    expect(cache.get('a')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('does not retain stale values when staleMs is zero', () => {
    const time = clock();
    const cache = new TtlCache<number>({ ttlMs: 1000, now: time.now });

    cache.set('a', 42);
    time.advance(1000);

    expect(cache.getStale('a')).toBeUndefined();
  });

  it('supports delete and clear', () => {
    const cache = new TtlCache<number>({ ttlMs: 1000 });
    cache.set('a', 1);
    cache.set('b', 2);

    cache.delete('a');
    expect(cache.getFresh('a')).toBeUndefined();
    expect(cache.getFresh('b')).toBe(2);

    cache.clear();
    expect(cache.getFresh('b')).toBeUndefined();
  });

  it('rejects a non-positive TTL', () => {
    expect(() => new TtlCache<number>({ ttlMs: 0 })).toThrow();
  });
});
