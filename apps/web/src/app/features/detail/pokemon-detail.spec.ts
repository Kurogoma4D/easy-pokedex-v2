import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LocaleService } from '../../i18n/locale.service';
import { PokemonDetail } from './pokemon-detail';
import type { PokemonDetailResponse } from './pokemon-detail.model';

const DETAIL_URL = '/api/pokemon/1';

const BULBASAUR: PokemonDetailResponse = {
  id: 1,
  name: { ja: 'フシギダネ', en: 'Bulbasaur' },
  imageUrl: 'https://example.test/1.png',
  height: 7,
  weight: 69,
  types: [
    { id: 'grass', name: { ja: 'くさ', en: 'Grass' } },
    { id: 'poison', name: { ja: 'どく', en: 'Poison' } },
  ],
  stats: [
    { id: 'hp', base: 45 },
    { id: 'attack', base: 49 },
    { id: 'defense', base: 49 },
    { id: 'special-attack', base: 65 },
    { id: 'special-defense', base: 65 },
    { id: 'speed', base: 45 },
  ],
  abilities: [
    { id: 'overgrow', name: { ja: 'しんりょく', en: 'Overgrow' }, isHidden: false },
    { id: 'chlorophyll', name: { ja: 'ようりょくそ', en: 'Chlorophyll' }, isHidden: true },
  ],
  evolutionChain: {
    id: 1,
    name: { ja: 'フシギダネ', en: 'Bulbasaur' },
    imageUrl: 'https://example.test/1.png',
    evolvesTo: [
      {
        id: 2,
        name: { ja: 'フシギソウ', en: 'Ivysaur' },
        imageUrl: 'https://example.test/2.png',
        evolvesTo: [
          {
            id: 3,
            name: { ja: 'フシギバナ', en: 'Venusaur' },
            imageUrl: 'https://example.test/3.png',
            evolvesTo: [],
          },
        ],
      },
    ],
  },
};

describe('PokemonDetail', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [PokemonDetail],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

  /** `:id` 入力を束縛してから、その id への保留中リクエストが現れるまでポーリングする。 */
  async function awaitRequest(
    fixture: ComponentFixture<PokemonDetail>,
    url: string,
  ): Promise<ReturnType<HttpTestingController['expectOne']>> {
    fixture.detectChanges();
    for (let i = 0; i < 50; i += 1) {
      await tick();
      const matches = httpMock.match((r) => r.url === url);
      if (matches.length > 0) {
        return matches[0];
      }
    }
    throw new Error(`Timed out waiting for request to ${url}`);
  }

  /** flush 後にレスポンス反映（resource 更新 → 再計算 → 描画）を進める。 */
  async function render(fixture: ComponentFixture<PokemonDetail>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function flushDetail(fixture: ComponentFixture<PokemonDetail>): Promise<void> {
    const req = await awaitRequest(fixture, DETAIL_URL);
    expect(req.request.method).toBe('GET');
    req.flush(BULBASAUR);
    await render(fixture);
  }

  function createFixture(id: string): ComponentFixture<PokemonDetail> {
    const fixture = TestBed.createComponent(PokemonDetail);
    fixture.componentRef.setInput('id', id);
    return fixture;
  }

  it('renders number, name, image, types, stats, abilities and the evolution chain', async () => {
    const fixture = createFixture('1');
    await flushDetail(fixture);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.detail__dex')?.textContent).toContain('#001');
    expect(el.querySelector('.detail__name')?.textContent).toContain('フシギダネ');
    expect(el.querySelector('.detail__art img')?.getAttribute('src')).toBe(
      'https://example.test/1.png',
    );
    expect(el.querySelectorAll('.detail__types app-type-chip').length).toBe(2);
    expect(el.querySelectorAll('.stats__row').length).toBe(6);
    expect(el.querySelectorAll('.abilities__item').length).toBe(2);
    expect(el.querySelectorAll('.evo__node').length).toBe(3);
  });

  it('marks the hidden ability', async () => {
    const fixture = createFixture('1');
    await flushDetail(fixture);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.abilities__hidden')).toBeTruthy();
  });

  it('exposes stats as accessible meters', async () => {
    const fixture = createFixture('1');
    await flushDetail(fixture);
    const el = fixture.nativeElement as HTMLElement;
    const meter = el.querySelector('.stats__bar[role="meter"]');

    expect(meter?.getAttribute('aria-valuemax')).toBe('255');
    expect(meter?.getAttribute('aria-valuenow')).toBeTruthy();
    expect(meter?.getAttribute('aria-label')).toBeTruthy();
  });

  it('localizes names when the locale changes', async () => {
    const fixture = createFixture('1');
    await flushDetail(fixture);
    const el = fixture.nativeElement as HTMLElement;

    TestBed.inject(LocaleService).setLocale('en');
    await render(fixture);

    expect(el.querySelector('.detail__name')?.textContent).toContain('Bulbasaur');
  });

  it('shows a loading status before the response arrives', async () => {
    const fixture = createFixture('1');
    const req = await awaitRequest(fixture, DETAIL_URL);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.detail__status--loading')).toBeTruthy();

    req.flush(BULBASAUR);
    await render(fixture);
    expect(el.querySelector('.detail__status--loading')).toBeFalsy();
  });

  it('shows a not-found message on a 404 and no retry-recoverable content', async () => {
    const fixture = createFixture('1');
    const req = await awaitRequest(fixture, DETAIL_URL);
    req.flush({ error: 'not found' }, { status: 404, statusText: 'Not Found' });
    await render(fixture);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.detail__status--error')?.textContent).toContain(
      'みつかりませんでした',
    );
  });

  it('shows an error state and retries on demand', async () => {
    const fixture = createFixture('1');
    const failing = await awaitRequest(fixture, DETAIL_URL);
    failing.flush({ error: 'upstream down' }, { status: 502, statusText: 'Bad Gateway' });
    await render(fixture);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.detail__status--error')).toBeTruthy();

    const retry = el.querySelector('.detail__retry') as HTMLButtonElement;
    retry.click();
    await flushDetail(fixture);

    expect(el.querySelector('.detail__status--error')).toBeFalsy();
    expect(el.querySelector('.detail__name')?.textContent).toContain('フシギダネ');
  });
});
