import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { LocaleService } from '../../i18n/locale.service';
import { TypeId } from '../mock/pokemon-mock-data';
import { PokemonCard } from '../shared/pokemon-card';
import {
  PokemonApiService,
  type PokemonListPage,
  type PokemonSearchRequest,
} from './pokemon-api.service';
import type { PokemonListItem } from './pokemon-list.model';
import { PokemonSearch } from './pokemon-search';

/** 1 ページの取得件数。無限スクロールの 1 バッチ。BFF の MAX_LIMIT(100) 以下に収める。 */
const PAGE_SIZE = 24;

/**
 * 名前入力を BFF 検索へ反映するまでの待ち時間（ms）。1 文字ごとに上流ファンアウトを伴う検索を
 * 走らせないよう、入力が落ち着いてから問い合わせる。タイプ・世代は離散選択のため即時反映する。
 */
const NAME_DEBOUNCE_MS = 350;

/** 文言テンプレートの `{count}` を実数で置換する。 */
function withCount(template: string, count: number): string {
  return template.replace('{count}', String(count));
}

/** 検索条件（名前・タイプ・世代）。ブラウズと検索の切り替え判定と BFF クエリの組み立てに使う。 */
interface SearchCriteria {
  readonly name: string;
  readonly types: readonly TypeId[];
  readonly generation: string;
}

function isActive(criteria: SearchCriteria): boolean {
  return criteria.name.trim() !== '' || criteria.types.length > 0 || criteria.generation !== '';
}

/**
 * 一覧画面（FR-1 / FR-2）。
 *
 * フィルタ未指定のときは BFF の `/pokemon/list` を表示し（ブラウズ）、名前・タイプ・世代の
 * いずれかが指定されると `/pokemon/search` のサーバーサイド検索へ切り替える。どちらのモードも
 * 同じ無限スクロール（センチネル＋ IntersectionObserver）で次ページを積み増し、同じカード描画を使う。
 * 検索はクライアント側で取得済みを絞り込むのではなく BFF で完結させる（spec 10. Open Questions）。
 *
 * 名前入力は 1 文字ごとの上流ファンアウトを避けるためデバウンスし、タイプ・世代は即時に反映する。
 * 条件が変わるたびに蓄積済みページを破棄して先頭ページから取り直す。タイプは検索 UI 側で
 * 5 件に制限し、BFF の 400（タイプ超過・不正な世代）を招く入力を送らない。
 *
 * エラー表示は取得状況で出し分ける。初回ロードの失敗（取得済みカードなし）は画面全体のエラーへ、
 * ページ送り中の失敗（取得済みカードあり）はグリッドを残したままセンチネル位置のインラインエラーへ
 * 反映する。どちらも再取得は失敗したオフセットに対して行う。
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
          {{ errorLabel() }}
          <button class="list__retry" type="button" (click)="retry()">
            {{ messages()['list.retry'] }}
          </button>
        </p>
      } @else if (items().length === 0 && isLoading()) {
        <p class="list__empty">{{ loadingLabel() }}</p>
      } @else if (items().length === 0) {
        <p class="list__empty">{{ messages()['list.empty'] }}</p>
      } @else {
        <ul class="list__grid" role="list">
          @for (item of items(); track item.id) {
            <li>
              <app-pokemon-card [item]="item" />
            </li>
          }
        </ul>

        @if (pagingError()) {
          <p class="list__paging-error" role="alert">
            {{ errorLabel() }}
            <button class="list__retry" type="button" (click)="retry()">
              {{ messages()['list.retry'] }}
            </button>
          </p>
        } @else if (hasMore()) {
          <div #sentinel class="list__sentinel" aria-hidden="true">
            <span class="list__loading">{{ loadingLabel() }}</span>
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

  /** UI の生の検索条件。入力に即追従する。 */
  private readonly rawCriteria = computed<SearchCriteria>(() => ({
    name: this.name(),
    types: this.selectedTypes(),
    generation: this.generation(),
  }));

  /**
   * 実際に BFF へ反映する検索条件。生条件をデバウンスしてからコミットする（名前の 1 文字ごとの
   * 上流ファンアウトを避ける）。resources・モード判定はすべてこのコミット済み条件のみを読むため、
   * デバウンス中の名前と即時のタイプ／世代が混ざって古い条件のリクエストが飛ぶことがない。
   */
  private readonly criteria = signal<SearchCriteria>({ name: '', types: [], generation: '' });

  /** フィルタが 1 つでも指定されているか。指定時は検索モード、未指定はブラウズモード。 */
  private readonly searchActive = computed(() => isActive(this.criteria()));

  /** 条件を一意に表す文字列キー。条件が変わると蓄積・オフセットを破棄する判断に使う。 */
  private readonly feedKey = computed(() => {
    const c = this.criteria();
    return JSON.stringify([c.name.trim(), [...c.types].sort(), c.generation]);
  });

  /**
   * 現在要求しているページのオフセット。進めると対応する `httpResource` が再取得する。
   * 条件キーが変わると `linkedSignal` が 0 へ同期的にリセットするため、条件変更時は古い条件で
   * 中間的なリクエストを発行せず、必ず先頭ページから取り直す。
   */
  private readonly requestedOffset = linkedSignal<string, number>({
    source: this.feedKey,
    computation: () => 0,
  });

  // --- ブラウズ（/pokemon/list） ---
  private readonly listPage = computed<PokemonListPage | undefined>(() =>
    this.searchActive() ? undefined : { limit: PAGE_SIZE, offset: this.requestedOffset() },
  );
  private readonly listResource = this.api.listResource(this.listPage);

  // --- 検索（/pokemon/search） ---
  private readonly searchRequest = computed<PokemonSearchRequest | undefined>(() => {
    if (!this.searchActive()) {
      return undefined;
    }
    const c = this.criteria();
    return {
      name: c.name,
      types: c.types,
      generation: c.generation,
      limit: PAGE_SIZE,
      offset: this.requestedOffset(),
    };
  });
  private readonly searchResource = this.api.searchResource(this.searchRequest);

  /** 現在モードの resource（ブラウズ／検索）。 */
  private readonly resource = computed(() =>
    this.searchActive() ? this.searchResource : this.listResource,
  );

  /**
   * 取得済みの全件。オフセット順にページを積み増し、重複（同一 offset の再取得）は無視する。
   * 条件キーが変わると空へリセットして、前条件の結果が新条件に混ざらないようにする。
   */
  private readonly loadedPages = linkedSignal<
    string,
    ReadonlyMap<number, readonly PokemonListItem[]>
  >({
    source: this.feedKey,
    computation: () => new Map(),
  });
  /** 次ページのオフセット。null なら最終ページ。未取得は undefined。条件変更で undefined に戻す。 */
  private readonly nextOffset = linkedSignal<string, number | null | undefined>({
    source: this.feedKey,
    computation: () => undefined,
  });

  protected readonly items = computed<readonly PokemonListItem[]>(() => {
    const pages = this.loadedPages();
    return [...pages.keys()].sort((a, b) => a - b).flatMap((offset) => pages.get(offset) ?? []);
  });

  protected readonly isLoading = computed(() => this.resource().isLoading());
  protected readonly error = computed(() => this.resource().error() !== undefined);
  /** 初回ロードの失敗（取得済みカードが無い）。画面全体のエラー表示に使う。 */
  protected readonly initialError = computed(() => this.error() && this.items().length === 0);
  /** ページ送り中の失敗（取得済みカードがある）。センチネル付近のインライン表示に使う。 */
  protected readonly pagingError = computed(() => this.error() && this.items().length > 0);
  protected readonly hasMore = computed(
    () => !this.error() && (this.nextOffset() === undefined || this.nextOffset() !== null),
  );

  protected readonly countLabel = computed(() =>
    withCount(this.messages()['list.count'], this.items().length),
  );
  protected readonly resultLabel = computed(() =>
    withCount(this.messages()['search.resultSummary'], this.items().length),
  );
  protected readonly loadingLabel = computed(() =>
    this.searchActive() ? this.messages()['search.searching'] : this.messages()['list.loadingMore'],
  );
  protected readonly errorLabel = computed(() =>
    this.searchActive() ? this.messages()['search.error'] : this.messages()['list.error'],
  );

  private readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');

  constructor() {
    // 生条件をデバウンスしてコミット済み条件へ反映する。名前入力は入力が落ち着いてから反映し、
    // 名前が空（クリア・リセット）になったときはブラウズへ即時に戻すためデバウンスしない。
    effect((onCleanup) => {
      const next = this.rawCriteria();
      if (next.name.trim() === '') {
        this.criteria.set(next);
        return;
      }
      const handle = setTimeout(() => this.criteria.set(next), NAME_DEBOUNCE_MS);
      onCleanup(() => clearTimeout(handle));
    });

    // 新しいページが届くたびに、その offset をキーに結果と次オフセットを取り込む。
    // エラー時は `value()` が例外を投げるため、値が無い状態（エラー・ローディング）は読み飛ばす。
    effect(() => {
      const resource = this.resource();
      if (resource.error() !== undefined || !resource.hasValue()) {
        return;
      }
      const response = resource.value();
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
    this.resource().reload();
  }
}
