import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { LocaleService } from '../../i18n/locale.service';
import { AuthService } from '../auth/auth.service';
import { FavoritesService } from './favorites.service';

/**
 * お気に入りトグルボタン。一覧カード・詳細ページに配置する（FR: 一覧/詳細でのトグル）。
 *
 * 未ログイン状態で操作されたときは登録/解除を行わずログイン画面へ誘導する（ゲスト保存はしない）。
 * ログイン後に元の画面へ戻れるよう、現在 URL を `redirect` クエリで渡す。
 */
@Component({
  selector: 'app-favorite-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="fav"
      [class.fav--on]="isFavorite()"
      [attr.aria-pressed]="isFavorite()"
      [attr.aria-label]="label()"
      [title]="label()"
      (click)="toggle($event)"
    >
      <span aria-hidden="true">{{ isFavorite() ? '★' : '☆' }}</span>
    </button>
  `,
  styles: `
    .fav {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-1);
      font-size: var(--font-size-display-md);
      line-height: 1;
      color: var(--color-text-muted);
      background: transparent;
      border: var(--border-width-chunky) solid var(--color-border-soft);
      border-radius: var(--radius-chip);
      cursor: pointer;
    }
    .fav--on {
      color: var(--color-accent, gold);
    }
  `,
})
export class FavoriteToggle {
  private readonly favorites = inject(FavoritesService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly localeService = inject(LocaleService);

  readonly pokemonId = input.required<number>();

  protected readonly isFavorite = computed(() => this.favorites.ids().has(this.pokemonId()));
  protected readonly label = computed(() =>
    this.isFavorite()
      ? this.localeService.translate('favorites.remove')
      : this.localeService.translate('favorites.add'),
  );

  protected async toggle(event: Event): Promise<void> {
    // カード全体がリンクのため、トグル操作で詳細へ遷移しないよう伝播を止める。
    event.preventDefault();
    event.stopPropagation();

    if (this.auth.user() === null) {
      void this.router.navigate(['/login'], {
        queryParams: { redirect: this.router.url },
      });
      return;
    }

    const id = this.pokemonId();
    if (this.favorites.ids().has(id)) {
      await this.favorites.remove(id);
    } else {
      await this.favorites.add(id);
    }
  }
}
