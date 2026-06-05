import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../../core/api-base-url';
import { LocaleService } from '../../i18n/locale.service';
import { AuthService } from '../auth/auth.service';
import type { PokemonDetailResponse } from '../detail/pokemon-detail.model';
import type { PokemonListItem } from '../list/pokemon-list.model';
import { PokemonCard } from '../shared/pokemon-card';
import { FavoritesService } from './favorites.service';

/**
 * お気に入り一覧ページ。ログインユーザーのお気に入りだけを表示する。
 *
 * お気に入り API（Part 3）が返すのは図鑑番号のみのため、各番号の表示用データ（名前・スプライト・
 * タイプ）は BFF の `/pokemon/:id` から取得して一覧と同じカードで描画する。お気に入りの集合は
 * `FavoritesService` の signal を参照し、トグルやログアウトに追従して再取得する。
 *
 * 未ログインではお気に入りを保持しないため、未ログイン時はログインへの誘導を表示する
 * （ゲスト保存はしない）。
 */
@Component({
  selector: 'app-favorites-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PokemonCard, RouterLink],
  template: `
    <section class="favorites">
      <header class="favorites__head">
        <h1 class="favorites__title">{{ messages()['favorites.title'] }}</h1>
      </header>

      @if (!isAuthenticated()) {
        <p class="favorites__notice">
          {{ messages()['favorites.loginRequired'] }}
          <a routerLink="/login" [queryParams]="{ redirect: '/favorites' }">{{
            messages()['nav.login']
          }}</a>
        </p>
      } @else if (loading()) {
        <p class="favorites__notice favorites__notice--loading" role="status">
          {{ messages()['favorites.loading'] }}
        </p>
      } @else if (error()) {
        <p class="favorites__notice" role="alert">
          {{ messages()['favorites.error'] }}
          <button class="favorites__retry" type="button" (click)="reload()">
            {{ messages()['list.retry'] }}
          </button>
        </p>
      } @else if (items().length === 0) {
        <p class="favorites__notice">{{ messages()['favorites.empty'] }}</p>
      } @else {
        <ul class="favorites__grid" role="list">
          @for (item of items(); track item.id) {
            <li>
              <app-pokemon-card [item]="item" />
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    .favorites {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }
    .favorites__head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-3);
      flex-wrap: wrap;
    }
    .favorites__title {
      margin: 0;
    }
    .favorites__notice {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      margin: 0;
      padding: var(--space-4);
      text-align: center;
      font-family: var(--font-display);
      font-size: var(--font-size-display-sm);
      color: var(--color-text-muted);
    }
    .favorites__notice a,
    .favorites__retry {
      font-family: var(--font-display);
      font-size: var(--font-size-display-sm);
      color: var(--color-text);
    }
    .favorites__notice--loading {
      animation: favorites-blink 800ms steps(2, end) infinite;
    }
    @keyframes favorites-blink {
      50% {
        opacity: 0.25;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .favorites__notice--loading {
        animation: none;
      }
    }
    .favorites__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
      gap: var(--space-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }
  `,
})
export class FavoritesPage {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly localeService = inject(LocaleService);
  private readonly auth = inject(AuthService);
  private readonly favorites = inject(FavoritesService);

  protected readonly messages = this.localeService.messages;
  protected readonly isAuthenticated = this.auth.isAuthenticated;

  private readonly _loading = signal(false);
  private readonly _error = signal(false);
  // 取得済みのカード表示データを図鑑番号で引けるよう保持する。お気に入り集合の変化に応じて差分取得する。
  private readonly _items = signal<ReadonlyMap<number, PokemonListItem>>(new Map());

  protected readonly loading = this._loading.asReadonly();
  protected readonly error = this._error.asReadonly();

  /** お気に入り集合の順序（新しい順は BFF が保証）でカード表示データを並べる。未取得 id は除く。 */
  protected readonly items = computed<readonly PokemonListItem[]>(() => {
    const map = this._items();
    return this.favorites
      .ids()
      .map((id) => map.get(id))
      .filter((item): item is PokemonListItem => item !== undefined);
  });

  constructor() {
    // お気に入り集合の変化（初期ロード・トグル）に追従して、未取得分の表示データを取り込む。
    effect(() => {
      const ids = this.favorites.ids();
      if (!this.auth.isAuthenticated()) {
        this._items.set(new Map());
        return;
      }
      void this.loadMissing(ids);
    });
  }

  /** エラー後にお気に入り一覧を取得し直す。 */
  protected reload(): void {
    this._error.set(false);
    void this.favorites.refresh();
  }

  /** まだ表示データを持たない図鑑番号について、詳細 API から取得して取り込む。 */
  private async loadMissing(ids: readonly number[]): Promise<void> {
    const map = this._items();
    const missing = ids.filter((id) => !map.has(id));
    if (missing.length === 0) {
      // 解除された id を取り除き、表示を集合に合わせる。
      this.pruneTo(ids);
      return;
    }
    this._loading.set(true);
    this._error.set(false);
    try {
      const fetched = await Promise.all(missing.map((id) => this.fetchSummary(id)));
      this._items.update((current) => {
        const next = new Map(current);
        for (const item of fetched) {
          next.set(item.id, item);
        }
        return next;
      });
      this.pruneTo(ids);
    } catch {
      this._error.set(true);
    } finally {
      this._loading.set(false);
    }
  }

  /** 表示データの集合をお気に入り集合に合わせ、解除済みの id を取り除く。 */
  private pruneTo(ids: readonly number[]): void {
    const keep = new Set(ids);
    this._items.update((current) => {
      const next = new Map<number, PokemonListItem>();
      for (const [id, item] of current) {
        if (keep.has(id)) {
          next.set(id, item);
        }
      }
      return next;
    });
  }

  /** 詳細 API のレスポンスをカード表示用の一覧アイテムへ写像して取得する。 */
  private async fetchSummary(id: number): Promise<PokemonListItem> {
    const detail = await firstValueFrom(
      this.http.get<PokemonDetailResponse>(`${this.baseUrl}/pokemon/${id}`),
    );
    return {
      id: detail.id,
      imageUrl: detail.imageUrl,
      name: detail.name,
      types: detail.types.map((type) => type.id),
    };
  }
}
