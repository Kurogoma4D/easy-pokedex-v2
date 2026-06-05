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
  typeMatchups: {
    weaknesses: [
      { multiplier: 4, types: [{ id: 'psychic', name: { ja: 'エスパー', en: 'Psychic' } }] },
      {
        multiplier: 2,
        types: [
          { id: 'fire', name: { ja: 'ほのお', en: 'Fire' } },
          { id: 'flying', name: { ja: 'ひこう', en: 'Flying' } },
          { id: 'ice', name: { ja: 'こおり', en: 'Ice' } },
        ],
      },
    ],
    resistances: [
      {
        multiplier: 0.5,
        types: [
          { id: 'water', name: { ja: 'みず', en: 'Water' } },
          { id: 'electric', name: { ja: 'でんき', en: 'Electric' } },
        ],
      },
      {
        multiplier: 0.25,
        types: [{ id: 'grass', name: { ja: 'くさ', en: 'Grass' } }],
      },
    ],
    immunities: [],
  },
  flavorText: {
    ja: 'うまれたときから せなかに ふしぎな タネが うえてあって、からだと ともに そだつという。',
    en: 'A strange seed was planted on its back at birth.',
  },
  genus: { ja: 'たねポケモン', en: 'Seed Pokémon' },
  generation: 'generation-i',
  isLegendary: false,
  isMythical: false,
};

/** 伝説/幻バッジ検証用。両フラグを立てて両バッジが同時に出ることを確認する。 */
const MEW: PokemonDetailResponse = {
  ...BULBASAUR,
  id: 151,
  name: { ja: 'ミュウ', en: 'Mew' },
  genus: { ja: 'しんしゅポケモン', en: 'New Species Pokémon' },
  flavorText: {
    ja: 'みなみアメリカの おくちで はっけんされたと いわれている。',
    en: 'So rare it is still said to be a mirage.',
  },
  isLegendary: true,
  isMythical: true,
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

  /** 任意の id・ペイロードで詳細を取得させて描画まで進める。 */
  async function flushDetailWith(
    fixture: ComponentFixture<PokemonDetail>,
    payload: PokemonDetailResponse,
  ): Promise<void> {
    const req = await awaitRequest(fixture, `/api/pokemon/${payload.id}`);
    expect(req.request.method).toBe('GET');
    req.flush(payload);
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

  it('localizes the name, type chips, abilities and evolution names when the locale changes', async () => {
    const fixture = createFixture('1');
    await flushDetail(fixture);
    const el = fixture.nativeElement as HTMLElement;

    // ja: 名前・タイプ・特性・進化チェーンの固有名詞がすべて日本語表記で出る。
    expect(el.querySelector('.detail__name')?.textContent).toContain('フシギダネ');
    expect(el.querySelector('.detail__types')?.textContent).toContain('くさ');
    expect(el.querySelector('.detail__types')?.textContent).toContain('どく');
    expect(el.querySelector('.abilities')?.textContent).toContain('しんりょく');
    expect(el.querySelector('.abilities')?.textContent).toContain('ようりょくそ');
    expect(el.querySelector('.evo')?.textContent).toContain('フシギソウ');
    expect(el.querySelector('.evo')?.textContent).toContain('フシギバナ');

    TestBed.inject(LocaleService).setLocale('en');
    await render(fixture);

    // en: 同じ固有名詞群が英語表記に切り替わる（UI 文言だけでなく API 由来の名前も追従する）。
    expect(el.querySelector('.detail__name')?.textContent).toContain('Bulbasaur');
    expect(el.querySelector('.detail__types')?.textContent).toContain('Grass');
    expect(el.querySelector('.detail__types')?.textContent).toContain('Poison');
    expect(el.querySelector('.abilities')?.textContent).toContain('Overgrow');
    expect(el.querySelector('.abilities')?.textContent).toContain('Chlorophyll');
    expect(el.querySelector('.evo')?.textContent).toContain('Ivysaur');
    expect(el.querySelector('.evo')?.textContent).toContain('Venusaur');

    // UI 文言（見出し・戻るリンク）も同時に切り替わる。
    expect(el.querySelector('.detail__back')?.textContent).toContain('Back to list');
  });

  it('restores a persisted locale so the detail renders in en on reload', async () => {
    // 永続化済みロケールでマウントすると、初回描画から英語固有名詞で出る（リロード復元の検証）。
    localStorage.setItem('easy-pokedex.locale', 'en');
    const fixture = createFixture('1');
    await flushDetail(fixture);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.detail__name')?.textContent).toContain('Bulbasaur');
    expect(el.querySelector('.detail__types')?.textContent).toContain('Grass');
  });

  it('renders weaknesses / resistances / immunities sections with multipliers and type chips', async () => {
    const fixture = createFixture('1');
    await flushDetail(fixture);
    const el = fixture.nativeElement as HTMLElement;

    const sections = el.querySelectorAll('.matchups .matchups__section');
    expect(sections.length).toBe(3);

    const [weak, resist, immune] = Array.from(sections);

    // 弱点: ×4（エスパー 1 件）と ×2（3 件）の 2 グループ・計 4 チップ。
    expect(weak.querySelectorAll('.matchups__group').length).toBe(2);
    const weakMultipliers = Array.from(weak.querySelectorAll('.matchups__multiplier')).map((n) =>
      n.textContent?.trim(),
    );
    expect(weakMultipliers).toEqual(['×4', '×2']);
    expect(weak.querySelectorAll('app-type-chip').length).toBe(4);

    // 耐性: 倍率降順で ×0.5 と ×0.25 の 2 グループ。
    const resistMultipliers = Array.from(resist.querySelectorAll('.matchups__multiplier')).map(
      (n) => n.textContent?.trim(),
    );
    expect(resistMultipliers).toEqual(['×0.5', '×0.25']);
    expect(resist.querySelectorAll('app-type-chip').length).toBe(3);

    // 無効: エントリ無しなので空状態ラベルが出てチップは無い。
    expect(immune.querySelectorAll('.matchups__group').length).toBe(0);
    expect(immune.querySelector('.matchups__empty')?.textContent).toContain('なし');

    // チップのラベルは BFF DTO の localized name 由来で出る（静的辞書ではなく DTO が消費される）。
    expect(weak.textContent).toContain('エスパー');
    expect(weak.textContent).toContain('ほのお');
  });

  it('localizes the matchup type chips from the BFF DTO when the locale changes', async () => {
    const fixture = createFixture('1');
    await flushDetail(fixture);
    const el = fixture.nativeElement as HTMLElement;
    const weak = el.querySelector('.matchups .matchups__section') as HTMLElement;

    expect(weak.textContent).toContain('エスパー');

    TestBed.inject(LocaleService).setLocale('en');
    await render(fixture);

    expect(weak.textContent).toContain('Psychic');
    expect(weak.textContent).toContain('Fire');
  });

  it('localizes the matchup section headings when the locale changes', async () => {
    const fixture = createFixture('1');
    await flushDetail(fixture);
    const el = fixture.nativeElement as HTMLElement;

    const headings = (): (string | undefined)[] =>
      Array.from(el.querySelectorAll('.matchups__heading')).map((n) => n.textContent?.trim());

    expect(headings()).toEqual(['こうかばつぐん', 'いまひとつ', 'こうかなし']);

    TestBed.inject(LocaleService).setLocale('en');
    await render(fixture);

    expect(headings()).toEqual(['Weak to', 'Resists', 'Immune to']);
    // 空状態ラベルも追従する。
    expect(el.querySelector('.matchups__empty')?.textContent).toContain('None');
  });

  it('renders the dex entry, genus and generation from the DTO', async () => {
    const fixture = createFixture('1');
    await flushDetail(fixture);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.detail__flavor')?.textContent).toContain('ふしぎな タネ');
    expect(el.querySelector('.detail__genus')?.textContent).toContain('たねポケモン');
    // 世代は GENERATIONS の表示名へ解決される（識別子そのままではない）。
    const generation = el.querySelector('.detail__metrics')?.textContent ?? '';
    expect(generation).toContain('第1世代');
  });

  it('localizes the dex entry, genus and generation when the locale changes', async () => {
    const fixture = createFixture('1');
    await flushDetail(fixture);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.detail__flavor')?.textContent).toContain('ふしぎな タネ');
    expect(el.querySelector('.detail__genus')?.textContent).toContain('たねポケモン');
    expect(el.querySelector('.detail__metrics')?.textContent).toContain('第1世代');

    TestBed.inject(LocaleService).setLocale('en');
    await render(fixture);

    expect(el.querySelector('.detail__flavor')?.textContent).toContain('strange seed');
    expect(el.querySelector('.detail__genus')?.textContent).toContain('Seed Pokémon');
    expect(el.querySelector('.detail__metrics')?.textContent).toContain('Generation I');
  });

  it('omits the dex entry and genus when the localized strings are empty', async () => {
    const fixture = createFixture('1');
    await flushDetailWith(fixture, {
      ...BULBASAUR,
      flavorText: { ja: '', en: '' },
      genus: { ja: '', en: '' },
    });
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.detail__flavor')).toBeFalsy();
    expect(el.querySelector('.detail__genus')).toBeFalsy();
  });

  it('does not render legendary / mythical badges for an ordinary Pokémon', async () => {
    const fixture = createFixture('1');
    await flushDetail(fixture);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.detail__badges')).toBeFalsy();
  });

  it('renders both legendary and mythical badges and localizes them', async () => {
    const fixture = createFixture('151');
    await flushDetailWith(fixture, MEW);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.detail__badge--legendary')?.textContent).toContain('でんせつ');
    expect(el.querySelector('.detail__badge--mythical')?.textContent).toContain('まぼろし');

    TestBed.inject(LocaleService).setLocale('en');
    await render(fixture);

    expect(el.querySelector('.detail__badge--legendary')?.textContent).toContain('Legendary');
    expect(el.querySelector('.detail__badge--mythical')?.textContent).toContain('Mythical');
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
