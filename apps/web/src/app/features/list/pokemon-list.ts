import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { LocaleService } from '../../i18n/locale.service';
import { MOCK_LIST, MockListItem, TypeId } from '../mock/pokemon-mock-data';
import { PokemonCard } from '../shared/pokemon-card';
import { PokemonSearch } from './pokemon-search';

/** モックで一度に追加表示する件数。無限スクロールの段階読み込みを模す。 */
const PAGE_SIZE = 8;

/** 文言テンプレートの `{count}` を実数で置換する。 */
function withCount(template: string, count: number): string {
  return template.replace('{count}', String(count));
}

/**
 * 一覧画面のモックアップ（FR-1 / FR-2）。
 *
 * 検索／フィルタ UI を上部に置き、条件で絞り込んだ結果をカードグリッドで表示する。
 * 無限スクロールは画面下端のセンチネルを IntersectionObserver で監視し、表示件数を
 * 段階的に増やすことで「スクロール到達で次が読み込まれる」見え方を再現する。
 * データは静的モック（`MOCK_LIST`）で、ライブ取得は機能 Issue（#11/#12）が担う。
 */
@Component({
  selector: 'app-pokemon-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PokemonSearch, PokemonCard],
  template: `
    <section class="list">
      <header class="list__head">
        <h1 class="list__title">{{ messages()['list.title'] }}</h1>
        <p class="list__count">{{ countLabel() }}</p>
      </header>

      <app-pokemon-search
        [(name)]="name"
        [(selectedTypes)]="selectedTypes"
        [(generation)]="generation"
      />

      <p class="list__summary" aria-live="polite">{{ resultLabel() }}</p>

      @if (filtered().length === 0) {
        <p class="list__empty">{{ messages()['list.empty'] }}</p>
      } @else {
        <ul class="list__grid" role="list">
          @for (item of visible(); track item.id) {
            <li>
              <app-pokemon-card [item]="item" />
            </li>
          }
        </ul>

        @if (hasMore()) {
          <div #sentinel class="list__sentinel" aria-hidden="true">
            <span class="list__loading">{{ messages()['list.loadingMore'] }}</span>
          </div>
        } @else {
          <p class="list__end">— {{ messages()['list.endOfList'] }} —</p>
        }
      }
    </section>
  `,
  styles: `
    .list {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }
    .list__head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-3);
      flex-wrap: wrap;
    }
    .list__title {
      margin: 0;
    }
    .list__count {
      margin: 0;
      font-family: var(--font-display);
      font-size: var(--font-size-display-sm);
      color: var(--color-text-muted);
    }
    .list__summary {
      margin: 0;
      font-family: var(--font-display);
      font-size: var(--font-size-display-sm);
      color: var(--color-text);
    }
    .list__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
      gap: var(--space-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .list__empty,
    .list__end {
      margin: 0;
      text-align: center;
      font-family: var(--font-display);
      font-size: var(--font-size-display-sm);
      color: var(--color-text-muted);
    }
    .list__sentinel {
      display: flex;
      justify-content: center;
      padding: var(--space-3);
    }
    /* The dot-matrix "now loading" cue that sits at the scroll edge. */
    .list__loading {
      font-family: var(--font-display);
      font-size: var(--font-size-display-sm);
      color: var(--color-text-muted);
      animation: list-blink 800ms steps(2, end) infinite;
    }
    @keyframes list-blink {
      50% {
        opacity: 0.25;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .list__loading {
        animation: none;
      }
    }
  `,
})
export class PokemonList {
  private readonly localeService = inject(LocaleService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly messages = this.localeService.messages;

  protected readonly name = signal('');
  protected readonly selectedTypes = signal<readonly TypeId[]>([]);
  protected readonly generation = signal('');

  private readonly all = MOCK_LIST;
  private readonly visibleCount = signal(PAGE_SIZE);

  private readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');

  /** 条件で絞り込んだ全件。名前は部分一致（ja/en 双方）、タイプは AND。 */
  protected readonly filtered = computed<readonly MockListItem[]>(() => {
    const query = this.name().trim().toLowerCase();
    const types = this.selectedTypes();
    return this.all.filter((item) => {
      const matchesName =
        query.length === 0 ||
        (item.name.ja ?? '').toLowerCase().includes(query) ||
        (item.name.en ?? '').toLowerCase().includes(query);
      const matchesTypes = types.every((t) => item.types.includes(t));
      return matchesName && matchesTypes;
    });
  });

  protected readonly visible = computed(() => this.filtered().slice(0, this.visibleCount()));
  protected readonly hasMore = computed(() => this.visibleCount() < this.filtered().length);

  protected readonly countLabel = computed(() =>
    withCount(this.messages()['list.count'], this.all.length),
  );
  protected readonly resultLabel = computed(() =>
    withCount(this.messages()['search.resultSummary'], this.filtered().length),
  );

  constructor() {
    if (typeof IntersectionObserver === 'undefined') {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && this.hasMore()) {
        this.visibleCount.update((count) => count + PAGE_SIZE);
      }
    });
    this.destroyRef.onDestroy(() => observer.disconnect());

    // センチネルは @if / 絞り込みで差し替わるため、現在の要素を監視し直す。
    effect(() => {
      observer.disconnect();
      const el = this.sentinel()?.nativeElement;
      if (el) {
        observer.observe(el);
      }
    });
  }
}
