import { httpResource, type HttpResourceRef } from '@angular/common/http';
import { inject, Injectable, type Signal } from '@angular/core';
import { API_BASE_URL } from '../../core/api-base-url';
import type { PokemonDetailResponse } from '../detail/pokemon-detail.model';
import type { PokemonListResponse, PokemonSearchResponse } from './pokemon-list.model';

/** 一覧取得のページ指定。`httpResource` のリアクティブなリクエスト元として用いる。 */
export interface PokemonListPage {
  readonly limit: number;
  readonly offset: number;
}

/**
 * 検索取得のリクエスト指定（FR-2）。`/pokemon/search` のクエリに対応する。
 * `name` の部分一致・`types` の AND 絞り込み・`generation` を組み合わせ、結果をページングする。
 */
export interface PokemonSearchRequest {
  /** 名前の部分一致クエリ（ja/en）。 */
  readonly name: string;
  /** タイプ識別子（英語）。複数指定はすべてのタイプを持つものに絞る（AND）。 */
  readonly types: readonly string[];
  /** 世代識別子（例: `generation-i`）。空文字は世代で絞り込まない。 */
  readonly generation: string;
  readonly limit: number;
  readonly offset: number;
}

/**
 * BFF（`/pokemon/list` / `/pokemon/search` / `/pokemon/:idOrName`）を叩くフロントエンドの
 * データ取得サービス（FR-1 / FR-2 / FR-3 / FR-5）。
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
   * 指定条件で検索した結果ページを取得する `httpResource` を返す（FR-2）。
   * `request` が `undefined` を返す間はリクエストを発行しない（フィルタ未指定で一覧を見せる間など）。
   *
   * `type` は値ごとに繰り返しクエリ（`?type=grass&type=poison`）として送る。BFF はタイプを
   * 最大 5 件までしか受け付けず超過時に 400 を返すため、5 件を超える指定は送らない（呼び出し側で
   * 選択を 5 件に制限する）。空のタイプ・世代はクエリに含めない。
   */
  searchResource(
    request: Signal<PokemonSearchRequest | undefined>,
  ): HttpResourceRef<PokemonSearchResponse | undefined> {
    return httpResource<PokemonSearchResponse>(() => {
      const current = request();
      if (current === undefined) {
        return undefined;
      }
      const params: Record<string, string | number | readonly string[]> = {
        limit: current.limit,
        offset: current.offset,
      };
      const name = current.name.trim();
      if (name !== '') {
        params['name'] = name;
      }
      if (current.types.length > 0) {
        params['type'] = current.types;
      }
      if (current.generation !== '') {
        params['generation'] = current.generation;
      }
      return {
        url: `${this.baseUrl}/pokemon/search`,
        params,
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
