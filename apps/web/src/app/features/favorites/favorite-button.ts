import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';

import { LocaleService } from '../../i18n/locale.service';
import { AuthService } from '../auth/auth.service';
import { Icon } from '../../shared/icon/icon';
import { FavoritesService } from './favorites.service';

/**
 * お気に入りトグルボタン。一覧カード・詳細ページの双方に配置する共通部品。
 *
 * ログイン済みなら現在状態に応じて登録／解除を切り替え、`FavoritesService` の signal を
 * 介して全画面の表示が同期する。未ログインでお気に入り操作をした場合はサーバへ送らず、
 * 現在地を `redirect` クエリに乗せてログイン画面へ誘導する（ゲスト保存はしない）。
 */
@Component({
  selector: 'app-favorite-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <button
      type="button"
      class="favorite"
      [class.is-active]="active()"
      [attr.aria-pressed]="active()"
      [attr.aria-label]="label()"
      [title]="label()"
      (click)="toggle($event)"
    >
      <app-icon [name]="active() ? 'heart' : 'heart-outline'" />
    </button>
  `,
  styles: `
    .favorite {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-1);
      color: var(--color-text-muted);
      background-color: var(--color-surface-raised);
      border: var(--border-width-chunky) solid var(--color-border);
      border-radius: var(--radius-pixel);
      box-shadow: var(--shadow-dot-sm);
      cursor: pointer;
    }
    .favorite.is-active {
      /* Lit-LCD accent marks the active (favorited) state. */
      color: var(--lcd-2);
    }
  `,
})
export class FavoriteButton {
  private readonly favorites = inject(FavoritesService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly localeService = inject(LocaleService);

  /** 対象 Pokémon の図鑑番号。 */
  readonly pokemonId = input.required<number>();

  protected readonly active = computed(() => this.favorites.isFavorite(this.pokemonId()));
  protected readonly label = computed(() => {
    const messages = this.localeService.messages();
    return this.active() ? messages['favorites.remove'] : messages['favorites.add'];
  });

  /**
   * トグルを実行する。カード全体がリンクの一覧では、クリックが詳細遷移へ伝播しないよう停止する。
   * 未ログインなら送信せずログインへ誘導する（現在地を redirect に乗せる）。
   */
  protected toggle(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.auth.user() === null) {
      void this.router.navigate(['/login'], { queryParams: { redirect: this.router.url } });
      return;
    }
    void this.favorites.toggle(this.pokemonId());
  }
}
