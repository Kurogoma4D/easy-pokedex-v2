/**
 * フロントエンドのお気に入り状態管理。
 *
 * BFF の `/favorites`（Part 3 で実装済み・認証必須）を叩き、ログインユーザーの
 * お気に入り図鑑番号の集合を signal として公開する。認証セッションは HttpOnly Cookie で
 * 運ばれるため、すべてのリクエストを `withCredentials: true` で送る。
 *
 * 認証状態（`AuthService.user`）に追従し、ログイン時に一覧を取り込み、ログアウト時に集合を空へ倒す。
 * 未ログイン状態ではお気に入りを保持・送信しない（ゲスト保存はしない）。未ログインでの
 * トグル操作はログインへの誘導であり、本サービスはサーバ送信を行わず呼び出し側がルーティングする。
 */

import { HttpClient } from '@angular/common/http';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../../core/api-base-url';
import { AuthService } from '../auth/auth.service';
import type { FavoritesListResponse } from './favorites.model';

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly auth = inject(AuthService);

  private readonly _ids = signal<ReadonlySet<number>>(new Set());

  /** ログインユーザーのお気に入り図鑑番号の集合。未ログインなら空。 */
  readonly ids = computed<readonly number[]>(() => [...this._ids()]);

  constructor() {
    // 認証状態に追従する。ログイン（ユーザー確定）で一覧を取り込み、ログアウトで集合を空へ倒す。
    // 起動時の `/auth/me` 解決中（initializing）は何もしない。
    effect(() => {
      if (this.auth.initializing()) {
        return;
      }
      if (this.auth.user() !== null) {
        void this.refresh();
      } else {
        this._ids.set(new Set());
      }
    });
  }

  /** 指定 Pokémon がお気に入りかどうか（リアクティブ）。 */
  isFavorite(pokemonId: number): boolean {
    return this._ids().has(pokemonId);
  }

  /** サーバからお気に入り一覧を取り込み直す。未認証時の 401 などは空集合へ倒す。 */
  async refresh(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<FavoritesListResponse>(`${this.baseUrl}/favorites`, {
          withCredentials: true,
        }),
      );
      this._ids.set(new Set(res.favorites.map((favorite) => favorite.pokemonId)));
    } catch {
      this._ids.set(new Set());
    }
  }

  /**
   * お気に入りを登録する。楽観的に集合へ反映してから送信し、失敗時は元へ戻す。
   * 未ログイン時は呼び出し側がログインへ誘導する前提のため、本メソッドは呼ばない。
   */
  async add(pokemonId: number): Promise<void> {
    if (this._ids().has(pokemonId)) {
      return;
    }
    this.applyOptimistic(pokemonId, true);
    try {
      await firstValueFrom(
        this.http.post(`${this.baseUrl}/favorites`, { pokemonId }, { withCredentials: true }),
      );
    } catch {
      this.applyOptimistic(pokemonId, false);
    }
  }

  /** お気に入りを解除する。楽観的に集合から除いてから送信し、失敗時は元へ戻す。 */
  async remove(pokemonId: number): Promise<void> {
    if (!this._ids().has(pokemonId)) {
      return;
    }
    this.applyOptimistic(pokemonId, false);
    try {
      await firstValueFrom(
        this.http.delete(`${this.baseUrl}/favorites/${pokemonId}`, { withCredentials: true }),
      );
    } catch {
      this.applyOptimistic(pokemonId, true);
    }
  }

  /** 現在の状態に応じて登録／解除を切り替える。 */
  async toggle(pokemonId: number): Promise<void> {
    if (this._ids().has(pokemonId)) {
      await this.remove(pokemonId);
    } else {
      await this.add(pokemonId);
    }
  }

  private applyOptimistic(pokemonId: number, present: boolean): void {
    this._ids.update((current) => {
      const next = new Set(current);
      if (present) {
        next.add(pokemonId);
      } else {
        next.delete(pokemonId);
      }
      return next;
    });
  }
}
