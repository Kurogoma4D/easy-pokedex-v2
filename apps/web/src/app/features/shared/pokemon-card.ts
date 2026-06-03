import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LocaleService } from '../../i18n/locale.service';
import { PokemonListItem } from '../list/pokemon-list.model';
import { TypeChip } from './type-chip';

/** 図鑑番号を `#001` 形式へ整形する。 */
function formatDexNumber(id: number): string {
  return `#${id.toString().padStart(3, '0')}`;
}

/**
 * 一覧グリッドの 1 カード。図鑑番号・スプライト・名前・タイプを表示し、
 * カード全体を詳細画面へのリンクにする（FR-1）。
 */
@Component({
  selector: 'app-pokemon-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TypeChip],
  template: `
    <a class="card" [routerLink]="['/detail', item().id]">
      <span class="card__dex">{{ dexNumber() }}</span>
      <div class="card__art">
        @if (item().imageUrl) {
          <img [src]="item().imageUrl" [alt]="name()" loading="lazy" decoding="async" />
        } @else {
          <span class="card__art-fallback" aria-hidden="true">?</span>
        }
      </div>
      <span class="card__name">{{ name() }}</span>
      <span class="card__types">
        @for (type of item().types; track type) {
          <app-type-chip [type]="type" />
        }
      </span>
    </a>
  `,
  styles: `
    .card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-2) var(--space-2);
      background-color: var(--color-surface-raised);
      border: var(--border-width-chunky) solid var(--color-border);
      border-radius: var(--radius-panel);
      box-shadow: var(--shadow-dot-sm);
      text-decoration: none;
      color: var(--color-text);
      transition:
        transform var(--duration-fast) var(--easing-step),
        box-shadow var(--duration-fast) var(--easing-step);
    }
    .card:hover,
    .card:focus-visible {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-dot-md);
    }
    .card__dex {
      align-self: flex-start;
      font-family: var(--font-display);
      font-size: var(--font-size-display-sm);
      color: var(--color-text-muted);
    }
    .card__art {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      aspect-ratio: 1 / 1;
      /* The lit LCD window the sprite floats in. */
      background-color: var(--color-screen);
      border: var(--border-width-chunky) solid var(--color-border-soft);
      border-radius: var(--radius-chip);
      box-shadow: var(--shadow-screen-inset);
    }
    .card__art img {
      width: 80%;
      height: 80%;
      object-fit: contain;
      /* Snap upscaled sprites to crisp pixels rather than blurring them. */
      image-rendering: pixelated;
    }
    .card__art-fallback {
      font-family: var(--font-display);
      font-size: var(--font-size-display-lg);
      color: var(--color-text-muted);
    }
    .card__name {
      font-family: var(--font-display);
      font-size: var(--font-size-display-md);
      text-align: center;
    }
    .card__types {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1);
      justify-content: center;
    }
  `,
})
export class PokemonCard {
  private readonly localeService = inject(LocaleService);

  readonly item = input.required<PokemonListItem>();

  protected readonly dexNumber = computed(() => formatDexNumber(this.item().id));
  protected readonly name = computed(() => this.localeService.localizeName(this.item().name));
}
