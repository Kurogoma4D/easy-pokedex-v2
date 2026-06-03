import { TtlCache } from './cache.js';
import { PokeApiError } from './errors.js';
import { fetchJson } from './fetcher.js';
import type {
  PokeApiEvolutionChain,
  PokeApiPokemon,
  PokeApiPokemonSpecies,
  PokeApiResourceList,
  PokeApiType,
} from './types.js';

const DEFAULT_BASE_URL = 'https://pokeapi.co/api/v2';
const DEFAULT_TIMEOUT_MS = 5_000;
/** PokeAPI のデータは事実上不変のため長めの TTL を採る（spec 7. レイテンシ・上流負荷抑制）。 */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1_000;
/** TTL 超過後も stale として保持し、上流障害時のフォールバックに使う期間。 */
const DEFAULT_STALE_MS = 7 * 24 * 60 * 60 * 1_000;

export interface PokeApiClientOptions {
  /** 上流のベース URL。末尾スラッシュ有無は問わない。既定は公式 PokeAPI。 */
  readonly baseUrl?: string;
  /** リクエストタイムアウト（ミリ秒）。 */
  readonly timeoutMs?: number;
  /** キャッシュの鮮度保持期間（ミリ秒）。 */
  readonly ttlMs?: number;
  /** TTL 超過後の stale 保持期間（ミリ秒）。上流障害フォールバック用。 */
  readonly staleMs?: number;
  /** fetch 実装の注入口（テスト用）。 */
  readonly fetchImpl?: typeof fetch;
  /** 時刻取得関数の注入口（テスト用）。キャッシュと共有される。 */
  readonly now?: () => number;
}

/** リクエスト単位の上書きオプション。 */
export interface RequestOptions {
  readonly signal?: AbortSignal;
  /**
   * true の場合、鮮度を無視して上流へ再取得する（取得成功時はキャッシュも更新）。
   * 上流が失敗したら stale 値へフォールバックする挙動は通常時と同じ。
   */
  readonly forceRefresh?: boolean;
}

/**
 * キャッシュキーは「上流リソースを一意に決めるパス + 正規化済みクエリ」で構成する。
 * ベース URL は含めない（環境差でキャッシュが分断されるのを避ける）。同一リソースへの
 * 表記揺れ（クエリ順・パスの先頭/末尾スラッシュ）を吸収して同一キーに正規化する。
 */
export function buildCacheKey(path: string, query?: Record<string, string | number>): string {
  const normalizedPath = path.replace(/^\/+/, '').replace(/\/+$/, '');
  if (query === undefined) {
    return normalizedPath;
  }
  const params = new URLSearchParams();
  for (const key of Object.keys(query).sort()) {
    params.append(key, String(query[key]));
  }
  const serialized = params.toString();
  return serialized.length === 0 ? normalizedPath : `${normalizedPath}?${serialized}`;
}

export class PokeApiClient {
  readonly #baseUrl: string;
  readonly #timeoutMs: number;
  readonly #fetchImpl: typeof fetch;
  readonly #cache: TtlCache<unknown>;
  /**
   * 進行中の上流取得を cacheKey 単位で共有するための単一フライト管理。
   * 同一キーの cache-miss が同時に到来しても上流リクエストは 1 回に集約する（spec 7. 上流負荷抑制）。
   */
  readonly #inFlight = new Map<string, Promise<unknown>>();

  constructor(options: PokeApiClientOptions = {}) {
    this.#baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.#fetchImpl = options.fetchImpl ?? fetch;
    this.#cache = new TtlCache<unknown>({
      ttlMs: options.ttlMs ?? DEFAULT_TTL_MS,
      staleMs: options.staleMs ?? DEFAULT_STALE_MS,
      now: options.now,
    });
  }

  /**
   * キャッシュを参照しつつ任意リソースを取得する内部 API。各エンドポイント実装はこれを利用する。
   *
   * フォールバック方針:
   * - 鮮度を保つキャッシュがあればそれを返す（上流アクセスなし）。
   * - 上流取得に成功したらキャッシュを更新して返す。
   * - 上流が「障害」（5xx・タイムアウト・ネットワーク断）の場合のみ stale キャッシュへフォールバックする。
   *   404 などのクライアントエラーは stale を返さずそのまま投げる（誤った値の温存を避ける）。
   */
  async fetchResource<T>(
    path: string,
    query?: Record<string, string | number>,
    requestOptions: RequestOptions = {},
  ): Promise<T> {
    const cacheKey = buildCacheKey(path, query);

    if (requestOptions.forceRefresh !== true) {
      const fresh = this.#cache.getFresh(cacheKey);
      if (fresh !== undefined) {
        return fresh as T;
      }
    }

    const upstream = this.#fetchUpstream<T>(cacheKey, path, query);

    // 呼び出し側 signal は共有リクエストには伝播させない（1 呼び出しの中断が
    // 同一キーの他の待機者を巻き込まないため）。代わりに各呼び出しは自身の signal と
    // 共有リクエストを race し、自分の中断のみを観測する。
    const signal = requestOptions.signal;
    if (signal === undefined) {
      return upstream;
    }
    if (signal.aborted) {
      throw new PokeApiError('aborted', `Request for ${cacheKey} was aborted by the caller`);
    }
    return await new Promise<T>((resolve, reject) => {
      const onAbort = (): void => {
        reject(new PokeApiError('aborted', `Request for ${cacheKey} was aborted by the caller`));
      };
      signal.addEventListener('abort', onAbort, { once: true });
      upstream.then(
        (value) => {
          signal.removeEventListener('abort', onAbort);
          resolve(value);
        },
        (error: unknown) => {
          signal.removeEventListener('abort', onAbort);
          reject(error as Error);
        },
      );
    });
  }

  /**
   * cacheKey 単位で進行中の上流取得を共有する。新規取得は cache 更新と stale フォールバックを含み、
   * 解決・拒否いずれの場合も in-flight エントリを取り除く。
   */
  #fetchUpstream<T>(
    cacheKey: string,
    path: string,
    query?: Record<string, string | number>,
  ): Promise<T> {
    const existing = this.#inFlight.get(cacheKey);
    if (existing !== undefined) {
      return existing as Promise<T>;
    }

    const url = this.#buildUrl(path, query);
    const promise = (async (): Promise<T> => {
      try {
        const value = await fetchJson<T>(url, {
          timeoutMs: this.#timeoutMs,
          fetchImpl: this.#fetchImpl,
        });
        this.#cache.set(cacheKey, value);
        return value;
      } catch (error) {
        if (error instanceof PokeApiError && error.isUpstreamFailure) {
          const stale = this.#cache.getStale(cacheKey);
          if (stale !== undefined) {
            return stale as T;
          }
        }
        throw error;
      } finally {
        this.#inFlight.delete(cacheKey);
      }
    })();

    this.#inFlight.set(cacheKey, promise);
    return promise;
  }

  fetchPokemon(idOrName: string | number, options?: RequestOptions): Promise<PokeApiPokemon> {
    return this.fetchResource<PokeApiPokemon>(`pokemon/${idOrName}`, undefined, options);
  }

  fetchPokemonSpecies(
    idOrName: string | number,
    options?: RequestOptions,
  ): Promise<PokeApiPokemonSpecies> {
    return this.fetchResource<PokeApiPokemonSpecies>(
      `pokemon-species/${idOrName}`,
      undefined,
      options,
    );
  }

  fetchEvolutionChain(id: number, options?: RequestOptions): Promise<PokeApiEvolutionChain> {
    return this.fetchResource<PokeApiEvolutionChain>(`evolution-chain/${id}`, undefined, options);
  }

  fetchType(idOrName: string | number, options?: RequestOptions): Promise<PokeApiType> {
    return this.fetchResource<PokeApiType>(`type/${idOrName}`, undefined, options);
  }

  fetchPokemonList(
    params: { limit: number; offset: number },
    options?: RequestOptions,
  ): Promise<PokeApiResourceList> {
    return this.fetchResource<PokeApiResourceList>(
      'pokemon',
      { limit: params.limit, offset: params.offset },
      options,
    );
  }

  /** キャッシュを空にする（主にテスト・運用補助用）。 */
  clearCache(): void {
    this.#cache.clear();
  }

  #buildUrl(path: string, query?: Record<string, string | number>): string {
    const normalizedPath = path.replace(/^\/+/, '');
    const url = new URL(`${this.#baseUrl}/${normalizedPath}`);
    if (query !== undefined) {
      for (const key of Object.keys(query)) {
        url.searchParams.append(key, String(query[key]));
      }
    }
    return url.toString();
  }
}
