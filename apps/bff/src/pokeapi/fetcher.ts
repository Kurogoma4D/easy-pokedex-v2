import { PokeApiError } from './errors.js';

export interface FetchJsonOptions {
  /** タイムアウト（ミリ秒）。経過すると `timeout` 種別の PokeApiError を投げる。 */
  readonly timeoutMs: number;
  /** テスト容易性のための fetch 実装の注入口。既定はグローバル `fetch`。 */
  readonly fetchImpl?: typeof fetch;
  /** 呼び出し側でリクエストを中断するための signal。タイムアウト用 signal と合成される。 */
  readonly signal?: AbortSignal;
}

/**
 * 単一 URL を取得し JSON としてパースする。失敗はすべて PokeApiError に正規化する。
 *
 * タイムアウトは AbortController で実現し、呼び出し側 signal が渡された場合は
 * `AbortSignal.any` で合成して双方の中断を尊重する。
 */
export async function fetchJson<T>(url: string, options: FetchJsonOptions): Promise<T> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutController = new AbortController();
  const timer = setTimeout(() => {
    timeoutController.abort();
  }, options.timeoutMs);

  const signal =
    options.signal === undefined
      ? timeoutController.signal
      : AbortSignal.any([options.signal, timeoutController.signal]);

  let response: Response;
  try {
    response = await fetchImpl(url, { signal });
  } catch (cause) {
    // 呼び出し側自身の中断はタイムアウト・ネットワーク断と区別する。
    // これらは上流障害ではないため stale フォールバックの対象にしてはならない。
    if (options.signal?.aborted === true) {
      throw new PokeApiError('aborted', `Request to ${url} was aborted by the caller`, {
        cause,
      });
    }
    if (timeoutController.signal.aborted) {
      throw new PokeApiError(
        'timeout',
        `Request to ${url} timed out after ${options.timeoutMs}ms`,
        {
          cause,
        },
      );
    }
    throw new PokeApiError('network', `Failed to reach ${url}`, { cause });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new PokeApiError('http', `Upstream responded ${response.status} for ${url}`, {
      status: response.status,
    });
  }

  try {
    return (await response.json()) as T;
  } catch (cause) {
    throw new PokeApiError('parse', `Failed to parse JSON from ${url}`, { cause });
  }
}
