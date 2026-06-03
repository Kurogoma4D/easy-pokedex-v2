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

  it('rejects a non-positive maxEntries', () => {
    expect(() => new TtlCache<number>({ ttlMs: 1000, maxEntries: 0 })).toThrow();
  });

  it('bounds the entry count by evicting the oldest entries', () => {
    const cache = new TtlCache<number>({ ttlMs: 1000, maxEntries: 3 });

    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4);

    expect(cache.size).toBe(3);
    // 最古挿入の 'a' が退避され、残りは保持される。
    expect(cache.getFresh('a')).toBeUndefined();
    expect(cache.getFresh('b')).toBe(2);
    expect(cache.getFresh('c')).toBe(3);
    expect(cache.getFresh('d')).toBe(4);
  });

  it('prefers evicting discarded entries before live ones when over the cap', () => {
    const time = clock();
    const cache = new TtlCache<number>({
      ttlMs: 1000,
      staleMs: 0,
      maxEntries: 2,
      now: time.now,
    });

    cache.set('old', 1);
    time.advance(2000); // 'old' は discardAt を過ぎる。
    cache.set('live', 2);
    cache.set('overflow', 3); // 上限超過で退避が走る。

    expect(cache.size).toBe(2);
    // 破棄済みの 'old' が優先的に掃除され、生存中のエントリは残る。
    expect(cache.getStale('old')).toBeUndefined();
    expect(cache.getFresh('live')).toBe(2);
    expect(cache.getFresh('overflow')).toBe(3);
  });

  it('refreshes recency on update so a re-set key survives eviction', () => {
    const cache = new TtlCache<number>({ ttlMs: 1000, maxEntries: 2 });

    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('a', 10); // 再 set で 'a' が最新側へ移り、最古は 'b' になる。
    cache.set('c', 3);

    expect(cache.getFresh('b')).toBeUndefined();
    expect(cache.getFresh('a')).toBe(10);
    expect(cache.getFresh('c')).toBe(3);
  });
});
