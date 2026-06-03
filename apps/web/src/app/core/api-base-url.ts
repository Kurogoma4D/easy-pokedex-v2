import { InjectionToken } from '@angular/core';

/**
 * BFF のベース URL。フロントは PokeAPI へ直接アクセスせず、必ずこの URL 配下の BFF を叩く。
 * 既定値は `/api` で、`ng serve` 時は dev プロキシ（`proxy.conf.json`）が `/api` を BFF へ転送する。
 * 本番では配信元のリバースプロキシ等で `/api` を BFF にルーティングする前提とし、
 * 切り替えが必要な環境ではこのトークンを上書きする。
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => '/api',
});
