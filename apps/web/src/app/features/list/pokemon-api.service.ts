import { httpResource, type HttpResourceRef } from '@angular/common/http';
import { inject, Injectable, type Signal } from '@angular/core';
import { API_BASE_URL } from '../../core/api-base-url';
import type { PokemonDetailResponse } from '../detail/pokemon-detail.model';
import type { PokemonListResponse } from './pokemon-list.model';

/** 一覧取得のページ指定。`httpResource` のリアクティブなリクエスト元として用いる。 */
export interface PokemonListPage {
  readonly limit: number;
  readonly offset: number;
}

/**
 * BFF（`/pokemon/list` / `/pokemon/:idOrName`）を叩くフロントエンドのデータ取得サービス
 * （FR-1 / FR-3 / FR-5）。
 *
 * 取得は signal-first の `httpResource` で行う。呼び出し側が渡す signal の変化に追従して
 * 自動で再取得し、ローディング・エラーの状態も resource から取れる。PokeAPI へは直接アクセスせず、
 * 必ず BFF（`API_BASE_URL` 配下）経由で取得する。
 */
@Injectable({ providedIn: 'root' })
export class PokemonApiService {
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * 指定ページの一覧を取得する `httpResource` を返す。
   * `page` が `undefined` を返す間はリクエストを発行しない（無限スクロールの初期化前など）。
   */
  listResource(
    page: Signal<PokemonListPage | undefined>,
  ): HttpResourceRef<PokemonListResponse | undefined> {
    return httpResource<PokemonListResponse>(() => {
      const current = page();
      if (current === undefined) {
        return undefined;
      }
      return {
        url: `${this.baseUrl}/pokemon/list`,
        params: { limit: current.limit, offset: current.offset },
      };
    });
  }

  /**
   * 指定 Pokémon の詳細を取得する `httpResource` を返す（FR-3）。
   * `idOrName` が空文字を返す間はリクエストを発行しない（ルート入力の初期化前など）。
   */
  detailResource(idOrName: Signal<string>): HttpResourceRef<PokemonDetailResponse | undefined> {
    return httpResource<PokemonDetailResponse>(() => {
      const key = idOrName().trim();
      if (key === '') {
        return undefined;
      }
      return {
        url: `${this.baseUrl}/pokemon/${encodeURIComponent(key)}`,
      };
    });
  }
}
