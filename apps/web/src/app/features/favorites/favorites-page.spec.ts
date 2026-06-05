import { provideHttpClient, withFetch } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { API_BASE_URL } from '../../core/api-base-url';
import { AuthService } from '../auth/auth.service';
import type { PokemonDetailResponse } from '../detail/pokemon-detail.model';
import { FavoritesPage } from './favorites-page';
import { FavoritesService } from './favorites.service';

/** カード描画に必要な最小限を満たす詳細レスポンスのスタブを作る。 */
function detailStub(id: number, name: string): PokemonDetailResponse {
  return {
    id,
    name: { ja: name, en: name },
    imageUrl: `https://example.test/${id}.png`,
    height: 4,
    weight: 60,
    types: [{ id: 'electric', name: { ja: 'でんき', en: 'Electric' } }],
    stats: [],
    abilities: [],
    evolutionChain: { id, name: { ja: name, en: name }, imageUrl: null, evolvesTo: [] },
    typeMatchups: { weaknesses: [], resistances: [], immunities: [] },
    flavorText: { ja: '', en: '' },
    genus: { ja: '', en: '' },
    generation: 'generation-i',
    isLegendary: false,
    isMythical: false,
    cryUrl: null,
  };
}

describe('FavoritesPage', () => {
  let httpMock: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [FavoritesPage],
      providers: [
        provideHttpClient(withFetch()),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: '/api' },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    // 認証追従の effect を最初から登録しておく（root サービスの遅延生成でリフレッシュを取りこぼさない）。
    TestBed.inject(FavoritesService);
  });

  async function signIn(): Promise<void> {
    const pending = auth.restoreSession();
    httpMock.expectOne('/api/auth/me').flush({ user: { id: 1, email: 'a@example.com' } });
    await pending;
  }

  it('guides unauthenticated visitors to log in', async () => {
    const pending = auth.restoreSession();
    httpMock
      .expectOne('/api/auth/me')
      .flush({ error: 'unauthenticated' }, { status: 401, statusText: 'Unauthorized' });
    await pending;

    const fixture = TestBed.createComponent(FavoritesPage);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.favorites__notice')?.textContent).toContain('ログインして');
    expect(el.querySelector('a[href="/login?redirect=%2Ffavorites"]')).not.toBeNull();
    httpMock.expectNone('/api/favorites');
  });

  it('renders only the signed-in user favorites as cards', async () => {
    await signIn();
    // 認証確定で FavoritesService の一覧取得が走る。
    TestBed.tick();
    httpMock
      .expectOne('/api/favorites')
      .flush({ favorites: [{ pokemonId: 25 }, { pokemonId: 1 }] });
    await Promise.resolve();

    const fixture = TestBed.createComponent(FavoritesPage);
    await fixture.whenStable();

    // 各お気に入りの表示データを詳細 API から取得する。
    httpMock.expectOne('/api/pokemon/25').flush(detailStub(25, 'Pikachu'));
    httpMock.expectOne('/api/pokemon/1').flush(detailStub(1, 'Bulbasaur'));
    // allSettled の解決（複数マイクロタスク）を待ってからシグナル反映を描画する。
    await new Promise((resolve) => setTimeout(resolve, 0));
    TestBed.tick();

    const cards = (fixture.nativeElement as HTMLElement).querySelectorAll('app-pokemon-card');
    expect(cards.length).toBe(2);
  });

  it('keeps the successfully fetched cards when one summary request fails', async () => {
    await signIn();
    TestBed.tick();
    httpMock
      .expectOne('/api/favorites')
      .flush({ favorites: [{ pokemonId: 25 }, { pokemonId: 1 }] });
    await Promise.resolve();

    const fixture = TestBed.createComponent(FavoritesPage);
    await fixture.whenStable();

    httpMock.expectOne('/api/pokemon/25').flush(detailStub(25, 'Pikachu'));
    httpMock
      .expectOne('/api/pokemon/1')
      .flush({ error: 'boom' }, { status: 500, statusText: 'Server Error' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    TestBed.tick();

    // 1 件失敗しても成功分のカードは残す（全滅させない）。
    const cards = (fixture.nativeElement as HTMLElement).querySelectorAll('app-pokemon-card');
    expect(cards.length).toBe(1);
  });

  it('shows an empty message when the user has no favorites', async () => {
    await signIn();
    TestBed.tick();
    httpMock.expectOne('/api/favorites').flush({ favorites: [] });
    await Promise.resolve();

    const fixture = TestBed.createComponent(FavoritesPage);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-pokemon-card')).toBeNull();
    expect(el.querySelector('.favorites__notice')?.textContent).toContain('まだ');
  });

  afterEach(() => {
    httpMock.verify();
  });
});
