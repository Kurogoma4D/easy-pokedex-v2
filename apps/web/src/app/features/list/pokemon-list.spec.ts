import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LocaleService } from '../../i18n/locale.service';
import type { PokemonListItem, PokemonListResponse } from './pokemon-list.model';
import { PokemonList } from './pokemon-list';

const BASE_URL = '/api/pokemon/list';

/** テスト中に手動でセンチネル到達を発火できる IntersectionObserver スタブ。 */
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  private readonly observed = new Set<Element>();

  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.observed.add(target);
  }
  unobserve(target: Element): void {
    this.observed.delete(target);
  }
  disconnect(): void {
    this.observed.clear();
  }

  /** 監視中の要素が画面に入った状態を擬似的に通知する。 */
  triggerIntersection(): void {
    const entries = [...this.observed].map(
      (target) => ({ isIntersecting: true, target }) as IntersectionObserverEntry,
    );
    if (entries.length > 0) {
      this.callback(entries, this as unknown as IntersectionObserver);
    }
  }

  /** 現在いずれかの要素を監視しているインスタンスを返す。 */
  static active(): FakeIntersectionObserver | undefined {
    return FakeIntersectionObserver.instances.find((io) => io.observed.size > 0);
  }
}

function item(id: number, name: { ja: string; en: string }, types: string[]): PokemonListItem {
  return { id, imageUrl: `https://example.test/${id}.png`, name, types };
}

function pageResponse(
  offset: number,
  nextOffset: number | null,
  results: PokemonListItem[],
): PokemonListResponse {
  return { count: 100, offset, limit: 24, nextOffset, results };
}

describe('PokemonList', () => {
  let httpMock: HttpTestingController;
  let originalIO: typeof IntersectionObserver | undefined;

  beforeEach(async () => {
    localStorage.clear();
    FakeIntersectionObserver.instances = [];
    originalIO = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver =
      FakeIntersectionObserver as unknown as typeof IntersectionObserver;

    await TestBed.configureTestingModule({
      imports: [PokemonList],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    if (originalIO === undefined) {
      delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
    } else {
      globalThis.IntersectionObserver = originalIO;
    }
  });

  const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

  /**
   * 指定オフセットの保留中リクエストが現れるまでマクロタスクでポーリングする。
   *
   * リクエスト保留中は `whenStable()` が解決しないため await せず、Angular のスケジューラを
   * 走らせる目的でバックグラウンドに置く（返り値の `stable`）。リクエストを flush すると安定し、
   * 呼び出し側は `stable` を await できる。
   */
  async function awaitRequest(
    fixture: ComponentFixture<PokemonList>,
    offset: number,
  ): Promise<{
    req: ReturnType<HttpTestingController['expectOne']>;
    stable: Promise<unknown>;
  }> {
    fixture.detectChanges();
    const stable = fixture.whenStable();
    for (let i = 0; i < 50; i += 1) {
      await tick();
      const matches = httpMock.match(
        (r) => r.url === BASE_URL && r.params.get('offset') === String(offset),
      );
      if (matches.length > 0) {
        return { req: matches[0], stable };
      }
    }
    throw new Error(`Timed out waiting for /pokemon/list request with offset=${offset}`);
  }

  /** flush 後にレスポンス反映（resource 更新 → 再計算 → 描画）を進める。 */
  async function render(
    fixture: ComponentFixture<PokemonList>,
    stable: Promise<unknown>,
  ): Promise<void> {
    await stable;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** 指定オフセットのページ要求を待ち、モックレスポンスを返してから描画を反映する。 */
  async function flushPage(
    fixture: ComponentFixture<PokemonList>,
    offset: number,
    nextOffset: number | null,
    results: PokemonListItem[],
  ): Promise<void> {
    const { req, stable } = await awaitRequest(fixture, offset);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('limit')).toBe('24');
    req.flush(pageResponse(offset, nextOffset, results));
    await render(fixture, stable);
  }

  /** 指定オフセットの要求を待ち、上流エラーを返してから描画を反映する。 */
  async function flushError(fixture: ComponentFixture<PokemonList>, offset: number): Promise<void> {
    const { req, stable } = await awaitRequest(fixture, offset);
    req.flush({ error: 'upstream down' }, { status: 502, statusText: 'Bad Gateway' });
    await render(fixture, stable);
  }

  it('renders the dex title and a grid of cards from the BFF', async () => {
    const fixture = TestBed.createComponent(PokemonList);

    await flushPage(fixture, 0, 24, [
      item(1, { ja: 'フシギダネ', en: 'Bulbasaur' }, ['grass', 'poison']),
      item(4, { ja: 'ヒトカゲ', en: 'Charmander' }, ['fire']),
    ]);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.list__title')?.textContent).toContain('ずかん');
    expect(el.querySelectorAll('app-pokemon-card').length).toBe(2);
  });

  it('renders the embedded search/filter UI', async () => {
    const fixture = TestBed.createComponent(PokemonList);
    await flushPage(fixture, 0, null, [
      item(25, { ja: 'ピカチュウ', en: 'Pikachu' }, ['electric']),
    ]);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-pokemon-search')).toBeTruthy();
  });

  it('loads the next page when the sentinel comes into view', async () => {
    const fixture = TestBed.createComponent(PokemonList);
    await flushPage(fixture, 0, 24, [item(1, { ja: 'フシギダネ', en: 'Bulbasaur' }, ['grass'])]);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('app-pokemon-card').length).toBe(1);

    // センチネルが見えたことにして次ページを要求する。
    FakeIntersectionObserver.active()?.triggerIntersection();
    await flushPage(fixture, 24, null, [item(4, { ja: 'ヒトカゲ', en: 'Charmander' }, ['fire'])]);

    expect(el.querySelectorAll('app-pokemon-card').length).toBe(2);
  });

  it('filters the grid down when a name query excludes everything', async () => {
    const fixture = TestBed.createComponent(PokemonList);
    await flushPage(fixture, 0, null, [
      item(1, { ja: 'フシギダネ', en: 'Bulbasaur' }, ['grass']),
      item(4, { ja: 'ヒトカゲ', en: 'Charmander' }, ['fire']),
    ]);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('app-pokemon-card').length).toBe(2);

    const input = el.querySelector('.search__input') as HTMLInputElement;
    input.value = 'zzzzz-no-match';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelectorAll('app-pokemon-card').length).toBe(0);
    expect(el.querySelector('.list__empty')).toBeTruthy();
  });

  it('shows an error state and retries on demand', async () => {
    const fixture = TestBed.createComponent(PokemonList);
    await flushError(fixture, 0);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.list__error')).toBeTruthy();

    const retry = el.querySelector('.list__retry') as HTMLButtonElement;
    retry.click();
    await flushPage(fixture, 0, null, [item(7, { ja: 'ゼニガメ', en: 'Squirtle' }, ['water'])]);

    expect(el.querySelector('.list__error')).toBeFalsy();
    expect(el.querySelectorAll('app-pokemon-card').length).toBe(1);
  });

  it('keeps loaded cards and shows an inline retry when a paging request fails', async () => {
    const fixture = TestBed.createComponent(PokemonList);
    await flushPage(fixture, 0, 24, [item(1, { ja: 'フシギダネ', en: 'Bulbasaur' }, ['grass'])]);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('app-pokemon-card').length).toBe(1);

    // ページ 2 を要求してから上流エラーを返す。
    FakeIntersectionObserver.active()?.triggerIntersection();
    await flushError(fixture, 24);

    // 既読カードは残り、全画面エラーは出さず、インラインの再試行を出す。
    expect(el.querySelectorAll('app-pokemon-card').length).toBe(1);
    expect(el.querySelector('.list__error')).toBeFalsy();
    expect(el.querySelector('.list__paging-error')).toBeTruthy();

    // 再試行は失敗したオフセット（24）を取り直す。
    const retry = el.querySelector('.list__paging-error .list__retry') as HTMLButtonElement;
    retry.click();
    await flushPage(fixture, 24, null, [item(4, { ja: 'ヒトカゲ', en: 'Charmander' }, ['fire'])]);

    expect(el.querySelector('.list__paging-error')).toBeFalsy();
    expect(el.querySelectorAll('app-pokemon-card').length).toBe(2);
  });

  it('localizes the title and names when the locale changes', async () => {
    const fixture = TestBed.createComponent(PokemonList);
    await flushPage(fixture, 0, null, [item(1, { ja: 'フシギダネ', en: 'Bulbasaur' }, ['grass'])]);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.card__name')?.textContent).toContain('フシギダネ');

    TestBed.inject(LocaleService).setLocale('en');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('.list__title')?.textContent).toContain('POKÉDEX');
    expect(el.querySelector('.card__name')?.textContent).toContain('Bulbasaur');
  });
});
