/** PokeAPI 取得時に発生しうる失敗の分類。 */
export type PokeApiErrorKind =
  /** 上流が 4xx/5xx を返した。 */
  | 'http'
  /** 設定したタイムアウト内に応答が得られなかった。 */
  | 'timeout'
  /** ネットワーク到達不可など fetch 自体が失敗した。 */
  | 'network'
  /** レスポンスボディを JSON として解釈できなかった。 */
  | 'parse';

export interface PokeApiErrorOptions {
  readonly status?: number;
  readonly cause?: unknown;
}

/** クライアント層が投げる正規化済みエラー。呼び出し側はこの型で失敗要因を判別できる。 */
export class PokeApiError extends Error {
  readonly kind: PokeApiErrorKind;
  /** `http` の場合の上流ステータスコード。それ以外は undefined。 */
  readonly status?: number;

  constructor(kind: PokeApiErrorKind, message: string, options: PokeApiErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'PokeApiError';
    this.kind = kind;
    this.status = options.status;
  }

  /** 上流の 5xx やタイムアウト・ネットワーク断など、再試行やキャッシュ流用が妥当な失敗か。 */
  get isUpstreamFailure(): boolean {
    if (this.kind === 'timeout' || this.kind === 'network') {
      return true;
    }
    return this.kind === 'http' && this.status !== undefined && this.status >= 500;
  }
}
