/**
 * TTL 付きのインメモリキャッシュ。
 *
 * BFF は単一プロセス前提のため、外部ストアを使わずプロセス内 Map で保持する。各エントリは
 * 鮮度（TTL 内かどうか）に加え、TTL を過ぎても保持し続ける「stale」状態を持つ。これは上流障害時に
 * 期限切れの値をフォールバックとして流用するための設計（spec 7. 信頼性）。
 */

export interface CacheEntry<T> {
  readonly value: T;
  /** エントリが鮮度を失う時刻（epoch ミリ秒）。 */
  readonly expiresAt: number;
  /** stale 値としても保持されなくなる時刻（epoch ミリ秒）。 */
  readonly discardAt: number;
}

export interface TtlCacheOptions {
  /** 値が鮮度を保つ期間（ミリ秒）。 */
  readonly ttlMs: number;
  /**
   * TTL 経過後も stale 値として保持する追加期間（ミリ秒）。
   * 上流障害時のフォールバックに用いる。0 で stale 保持を無効化。
   */
  readonly staleMs?: number;
  /** テスト容易性のための時刻取得関数の注入口。既定は `Date.now`。 */
  readonly now?: () => number;
}

export interface CacheLookup<T> {
  readonly value: T;
  /** TTL 内であれば true、TTL 超過の stale 値であれば false。 */
  readonly fresh: boolean;
}

export class TtlCache<T> {
  readonly #store = new Map<string, CacheEntry<T>>();
  readonly #ttlMs: number;
  readonly #staleMs: number;
  readonly #now: () => number;

  constructor(options: TtlCacheOptions) {
    if (options.ttlMs <= 0) {
      throw new Error('ttlMs must be greater than 0');
    }
    this.#ttlMs = options.ttlMs;
    this.#staleMs = options.staleMs ?? 0;
    this.#now = options.now ?? Date.now;
  }

  /** 鮮度を問わず取得する。完全に破棄された（discardAt 超過）エントリは取り除いて undefined を返す。 */
  get(key: string): CacheLookup<T> | undefined {
    const entry = this.#store.get(key);
    if (entry === undefined) {
      return undefined;
    }
    const now = this.#now();
    if (now >= entry.discardAt) {
      this.#store.delete(key);
      return undefined;
    }
    return { value: entry.value, fresh: now < entry.expiresAt };
  }

  /** TTL 内の鮮度を保つ値のみを返す。stale 値は返さない。 */
  getFresh(key: string): T | undefined {
    const lookup = this.get(key);
    return lookup?.fresh === true ? lookup.value : undefined;
  }

  /** stale を許容して取得する。TTL 超過の値でも discardAt 前なら返す。 */
  getStale(key: string): T | undefined {
    return this.get(key)?.value;
  }

  set(key: string, value: T): void {
    const now = this.#now();
    this.#store.set(key, {
      value,
      expiresAt: now + this.#ttlMs,
      discardAt: now + this.#ttlMs + this.#staleMs,
    });
  }

  delete(key: string): void {
    this.#store.delete(key);
  }

  clear(): void {
    this.#store.clear();
  }

  /** 保持中のエントリ数（破棄済みを掃除せずに数える概算値）。 */
  get size(): number {
    return this.#store.size;
  }
}
