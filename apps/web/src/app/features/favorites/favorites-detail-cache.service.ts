import { HttpClient } from '@angular/common/http';
import { effect, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../core/api-base-url';
import type { PokemonDetailResponse } from '../detail/pokemon-detail.model';
import { FavoritesService } from './favorites.service';

/**
 * お気に入り id 集合に追従して各ポケモンの詳細を取得し、id→詳細のキャッシュを公開する。
 * 一括取得 API が無いため、未取得 id の詳細を BFF から個別に集めて埋める。取得済みは再取得しない。
 */
@Injectable({ providedIn: 'root' })
export class FavoritesDetailCache {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly favorites = inject(FavoritesService);

  private readonly _cache = signal<ReadonlyMap<number, PokemonDetailResponse>>(new Map());
  /** id→詳細の取得済みキャッシュ。 */
  readonly cache = this._cache.asReadonly();

  /**
   * 取得中の id。キャッシュ書き込みは await 後なので、これが無いと
   * orderedIds() が連続変化した際に同じ id を二重取得しうる。
   */
  private readonly inFlight = new Set<number>();

  constructor() {
    effect(() => {
      const ids = this.favorites.orderedIds();
      void this.fetchMissing(ids);
    });
  }

  private async fetchMissing(ids: readonly number[]): Promise<void> {
    const have = this._cache();
    const missing = ids.filter((id) => !have.has(id) && !this.inFlight.has(id));
    if (missing.length === 0) {
      return;
    }
    missing.forEach((id) => this.inFlight.add(id));
    try {
      const fetched = await Promise.all(
        missing.map((id) =>
          firstValueFrom(
            this.http.get<PokemonDetailResponse>(`${this.baseUrl}/pokemon/${id}`),
          ).catch(() => null),
        ),
      );
      this._cache.update((current) => {
        const next = new Map(current);
        fetched.forEach((detail) => {
          if (detail !== null) {
            next.set(detail.id, detail);
          }
        });
        return next;
      });
    } finally {
      missing.forEach((id) => this.inFlight.delete(id));
    }
  }
}
