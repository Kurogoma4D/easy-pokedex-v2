import { HttpClient } from '@angular/common/http';
import { effect, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../core/api-base-url';
import { AuthService } from '../auth/auth.service';

interface FavoritesResponse {
  readonly pokemonIds: number[];
}

/**
 * ログインユーザーのお気に入り（FR: お気に入り登録/解除/一覧）。BFF の `/favorites` を叩き、
 * お気に入り pokemon_id の集合を signal で公開する。
 *
 * 認証状態に追従する。ログイン時に一覧を読み込み、ログアウト時に集合を空へ戻す。
 * 状態は BFF に永続化されるため、フロントの集合は表示用のキャッシュとして扱う。
 */
@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly auth = inject(AuthService);

  private readonly _ids = signal<ReadonlySet<number>>(new Set());
  /** お気に入り pokemon_id の集合。 */
  readonly ids = this._ids.asReadonly();

  /** 新しい順のお気に入り pokemon_id 一覧（一覧ページ用）。 */
  private readonly _orderedIds = signal<readonly number[]>([]);
  readonly orderedIds = this._orderedIds.asReadonly();

  // 非同期書き込みの世代。ログアウトや再ログインで進め、解決済みの古い書き込みを無効化する。
  private generation = 0;

  constructor() {
    // ログイン状態に追従して一覧を読み直す。ログアウト時は集合を空へ戻す。
    effect(() => {
      const user = this.auth.user();
      this.generation++;
      if (user === null) {
        this._ids.set(new Set());
        this._orderedIds.set([]);
        return;
      }
      void this.reload();
    });
  }

  /** 指定 pokemon がお気に入りかを返す computed を生成する。 */
  isFavorite(pokemonId: number): boolean {
    return this._ids().has(pokemonId);
  }

  /** お気に入り集合を BFF から読み直す。 */
  async reload(): Promise<void> {
    const generation = this.generation;
    const res = await firstValueFrom(
      this.http.get<FavoritesResponse>(`${this.baseUrl}/favorites`, { withCredentials: true }),
    );
    if (generation !== this.generation) {
      return;
    }
    this._orderedIds.set(res.pokemonIds);
    this._ids.set(new Set(res.pokemonIds));
  }

  /** お気に入りを登録する。 */
  async add(pokemonId: number): Promise<void> {
    const generation = this.generation;
    await firstValueFrom(
      this.http.put(`${this.baseUrl}/favorites/${pokemonId}`, null, { withCredentials: true }),
    );
    if (generation !== this.generation) {
      return;
    }
    this._ids.update((set) => new Set(set).add(pokemonId));
    this._orderedIds.update((ids) => (ids.includes(pokemonId) ? ids : [pokemonId, ...ids]));
  }

  /** お気に入りを解除する。 */
  async remove(pokemonId: number): Promise<void> {
    const generation = this.generation;
    await firstValueFrom(
      this.http.delete(`${this.baseUrl}/favorites/${pokemonId}`, { withCredentials: true }),
    );
    if (generation !== this.generation) {
      return;
    }
    this._ids.update((set) => {
      const next = new Set(set);
      next.delete(pokemonId);
      return next;
    });
    this._orderedIds.update((ids) => ids.filter((id) => id !== pokemonId));
  }
}
