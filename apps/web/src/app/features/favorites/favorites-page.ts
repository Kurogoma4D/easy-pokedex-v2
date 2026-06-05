import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LocaleService } from '../../i18n/locale.service';
import type { PokemonDetailResponse } from '../detail/pokemon-detail.model';
import type { PokemonListItem } from '../list/pokemon-list.model';
import { PokemonCard } from '../shared/pokemon-card';
import { FavoritesDetailCache } from './favorites-detail-cache.service';
import { FavoriteToggle } from './favorite-toggle';
import { FavoritesService } from './favorites.service';

/** 詳細レスポンスを一覧カードが要求する形へ写像する。 */
function toListItem(detail: PokemonDetailResponse): PokemonListItem {
  return {
    id: detail.id,
    imageUrl: detail.imageUrl,
    name: detail.name,
    types: detail.types.map((t) => t.id),
  };
}

/**
 * お気に入り一覧ページ（FR: 専用一覧ページ）。ログインユーザーのお気に入りのみを表示する。
 * ルートは `authGuard` で保護され、未ログインはログインへ誘導されるため、ここでは描画に専念する。
 *
 * お気に入りは pokemon_id の集合として持つため、各 id の詳細を取得してカードへ写像する。
 */
@Component({
  selector: 'app-favorites-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PokemonCard, FavoriteToggle],
  template: `
    <section class="favorites">
      <header class="favorites__head">
        <h1 class="favorites__title">{{ messages()['favorites.title'] }}</h1>
        <p class="favorites__count">{{ countLabel() }}</p>
      </header>

      @if (ids().length === 0) {
        <p class="favorites__empty">{{ messages()['favorites.empty'] }}</p>
      } @else {
        <ul class="favorites__grid" role="list">
          @for (item of items(); track item.id) {
            <li class="favorites__cell">
              <app-pokemon-card [item]="item" />
              <div class="favorites__toggle">
                <app-favorite-toggle [pokemonId]="item.id" />
              </div>
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
    .favorites__count {
      margin: 0;
      font-family: var(--font-display);
      font-size: var(--font-size-display-sm);
      color: var(--color-text-muted);
    }
    .favorites__empty {
      margin: 0;
      text-align: center;
      font-family: var(--font-display);
      font-size: var(--font-size-display-sm);
      color: var(--color-text-muted);
    }
    .favorites__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
      gap: var(--space-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .favorites__cell {
      position: relative;
    }
    .favorites__toggle {
      position: absolute;
      top: var(--space-2);
      right: var(--space-2);
    }
  `,
})
export class FavoritesPage {
  private readonly favorites = inject(FavoritesService);
  private readonly detailCache = inject(FavoritesDetailCache);
  private readonly localeService = inject(LocaleService);

  protected readonly messages = this.localeService.messages;
  protected readonly ids = this.favorites.orderedIds;

  /** 表示用のカード一覧。お気に入り順を保ち、詳細が揃ったものから写像する。 */
  protected readonly items = computed<readonly PokemonListItem[]>(() => {
    const loaded = this.detailCache.cache();
    return this.favorites
      .orderedIds()
      .map((id) => loaded.get(id))
      .filter((detail): detail is PokemonDetailResponse => detail !== undefined)
      .map(toListItem);
  });

  protected readonly countLabel = computed(() =>
    this.messages()['favorites.count'].replace('{count}', String(this.ids().length)),
  );
}
