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
import { TypeId } from '../mock/pokemon-mock-data';
import { PokemonCard } from '../shared/pokemon-card';
import { PokemonApiService, type PokemonListPage } from './pokemon-api.service';
import type { PokemonListItem } from './pokemon-list.model';
import { PokemonSearch } from './pokemon-search';

/** 1 ページの取得件数。無限スクロールの 1 バッチ。BFF の MAX_LIMIT(100) 以下に収める。 */
const PAGE_SIZE = 24;

/** 文言テンプレートの `{count}` を実数で置換する。 */
function withCount(template: string, count: number): string {
  return template.replace('{count}', String(count));
}

/**
 * 一覧画面（FR-1）。BFF の `/pokemon/list` を `httpResource` で取得して表示する。
 *
 * 無限スクロールは画面下端のセンチネルを IntersectionObserver で監視し、到達時に次ページの
 * オフセット（レスポンスの `nextOffset`）を要求する。取得済みページはオフセットをキーに重複なく
 * 蓄積し、グリッドに積み増す。
 *
 * エラー表示は取得状況で出し分ける。初回ロードの失敗（取得済みカードなし）は画面全体のエラーへ、
 * ページ送り中の失敗（取得済みカードあり）はグリッドを残したままセンチネル位置のインラインエラーへ
 * 反映する。どちらも再取得は失敗したオフセットに対して行う。
 *
 * 検索／フィルタ UI（FR-2）は表示し、取得済みの結果に対する名前・タイプの絞り込みをクライアント側で
 * 行う。世代フィルタおよび BFF 検索エンドポイントへの接続は後続 Issue（#13）が担う。
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

      @if (initialError()) {
        <p class="list__error" role="alert">
          {{ messages()['list.error'] }}
          <button class="list__retry" type="button" (click)="retry()">
            {{ messages()['list.retry'] }}
          </button>
        </p>
      } @else if (filtered().length === 0 && !isLoading()) {
        <p class="list__empty">{{ messages()['list.empty'] }}</p>
      } @else {
        <ul class="list__grid" role="list">
          @for (item of filtered(); track item.id) {
            <li>
              <app-pokemon-card [item]="item" />
            </li>
          }
        </ul>

        @if (pagingError()) {
          <p class="list__paging-error" role="alert">
            {{ messages()['list.error'] }}
            <button class="list__retry" type="button" (click)="retry()">
              {{ messages()['list.retry'] }}
            </button>
          </p>
        } @else if (hasMore()) {
          <div #sentinel class="list__sentinel" aria-hidden="true">
            <span class="list__loading">{{ messages()['list.loadingMore'] }}</span>
          </div>
        } @else if (loaded().length > 0) {
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
    .list__error {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      margin: 0;
      text-align: center;
      font-family: var(--font-display);
      font-size: var(--font-size-display-sm);
      color: var(--color-text);
    }
    .list__retry {
      font-family: var(--font-display);
      font-size: var(--font-size-display-sm);
    }
    /* Mid-scroll paging failure: sits below the already-loaded grid instead of
     * replacing it, so loaded cards stay visible while retry re-fetches. */
    .list__paging-error {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      margin: 0;
      padding: var(--space-3);
      text-align: center;
      font-family: var(--font-display);
      font-size: var(--font-size-display-sm);
      color: var(--color-text);
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
  private readonly api = inject(PokemonApiService);

  protected readonly messages = this.localeService.messages;

  protected readonly name = signal('');
  protected readonly selectedTypes = signal<readonly TypeId[]>([]);
  protected readonly generation = signal('');

  /** 現在要求しているページのオフセット。これを進めると `httpResource` が再取得する。 */
  private readonly requestedOffset = signal(0);
  private readonly page = computed<PokemonListPage>(() => ({
    limit: PAGE_SIZE,
    offset: this.requestedOffset(),
  }));

  private readonly resource = this.api.listResource(this.page);

  /** 取得済みの全件。オフセット順にページを積み増し、重複（同一 offset の再取得）は無視する。 */
  private readonly loadedPages = signal<ReadonlyMap<number, readonly PokemonListItem[]>>(new Map());
  /** 次ページのオフセット。null なら最終ページに到達済み。未取得の間は undefined。 */
  private readonly nextOffset = signal<number | null | undefined>(undefined);

  protected readonly loaded = computed<readonly PokemonListItem[]>(() => {
    const pages = this.loadedPages();
    return [...pages.keys()].sort((a, b) => a - b).flatMap((offset) => pages.get(offset) ?? []);
  });

  protected readonly isLoading = computed(() => this.resource.isLoading());
  protected readonly error = computed(() => this.resource.error() !== undefined);
  /** 初回ロードの失敗（取得済みカードが無い）。画面全体のエラー表示に使う。 */
  protected readonly initialError = computed(() => this.error() && this.loaded().length === 0);
  /** ページ送り中の失敗（取得済みカードがある）。センチネル付近のインライン表示に使う。 */
  protected readonly pagingError = computed(() => this.error() && this.loaded().length > 0);
  protected readonly hasMore = computed(
    () => !this.error() && (this.nextOffset() === undefined || this.nextOffset() !== null),
  );

  /** 取得済み結果に対する名前（ja/en 部分一致）・タイプ（AND）のクライアント絞り込み。 */
  protected readonly filtered = computed<readonly PokemonListItem[]>(() => {
    const query = this.name().trim().toLowerCase();
    const types = this.selectedTypes();
    if (query.length === 0 && types.length === 0) {
      return this.loaded();
    }
    return this.loaded().filter((item) => {
      const matchesName =
        query.length === 0 ||
        (item.name.ja ?? '').toLowerCase().includes(query) ||
        (item.name.en ?? '').toLowerCase().includes(query);
      const matchesTypes = types.every((t) => item.types.includes(t));
      return matchesName && matchesTypes;
    });
  });

  protected readonly countLabel = computed(() =>
    withCount(this.messages()['list.count'], this.loaded().length),
  );
  protected readonly resultLabel = computed(() =>
    withCount(this.messages()['search.resultSummary'], this.filtered().length),
  );

  private readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');

  constructor() {
    // 新しいページが届くたびに、その offset をキーに結果と次オフセットを取り込む。
    // エラー時は `value()` が例外を投げるため、値が無い状態（エラー・ローディング）は読み飛ばす。
    effect(() => {
      if (this.resource.error() !== undefined || !this.resource.hasValue()) {
        return;
      }
      const response = this.resource.value();
      if (response === undefined) {
        return;
      }
      this.loadedPages.update((pages) => {
        if (pages.has(response.offset)) {
          return pages;
        }
        const next = new Map(pages);
        next.set(response.offset, response.results);
        return next;
      });
      this.nextOffset.set(response.nextOffset);
    });

    if (typeof IntersectionObserver === 'undefined') {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        this.loadNext();
      }
    });
    this.destroyRef.onDestroy(() => observer.disconnect());

    // センチネルは @if で差し替わるため、現在の要素を監視し直す。
    effect(() => {
      observer.disconnect();
      const el = this.sentinel()?.nativeElement;
      if (el) {
        observer.observe(el);
      }
    });
  }

  /** 次ページのオフセットを要求する。取得中・最終ページ・エラー時は何もしない。 */
  private loadNext(): void {
    if (this.isLoading() || this.error()) {
      return;
    }
    const next = this.nextOffset();
    if (next === null || next === undefined) {
      return;
    }
    this.requestedOffset.set(next);
  }

  /** エラー後にもう一度同じページを取得し直す。 */
  protected retry(): void {
    this.resource.reload();
  }
}
