import { provideHttpClient, withFetch } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { API_BASE_URL } from '../../core/api-base-url';
import { AuthService } from '../auth/auth.service';
import { FavoriteButton } from './favorite-button';
import { FavoritesService } from './favorites.service';

@Component({
  selector: 'app-host',
  imports: [FavoriteButton],
  template: `<app-favorite-button [pokemonId]="25" />`,
})
class Host {}

describe('FavoriteButton', () => {
  let httpMock: HttpTestingController;
  let auth: AuthService;
  let router: Router;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        provideHttpClient(withFetch()),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: '/api' },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    // 認証追従の effect を最初から登録しておく（root サービスの遅延生成でリフレッシュを取りこぼさない）。
    TestBed.inject(FavoritesService);
  });

  async function signIn(): Promise<void> {
    const pending = auth.restoreSession();
    httpMock.expectOne('/api/auth/me').flush({ user: { id: 1, email: 'a@example.com' } });
    await pending;
  }

  it('redirects unauthenticated users to login instead of saving', async () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    const button = (fixture.nativeElement as HTMLElement).querySelector(
      'button',
    ) as HTMLButtonElement;
    button.click();
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { redirect: router.url },
    });
    // ゲスト保存はしない: お気に入り API を一切叩かない。
    httpMock.expectNone('/api/favorites');
  });

  it('toggles a favorite for authenticated users', async () => {
    await signIn();
    // 認証確定で一覧取得が走るので吸収する。
    TestBed.tick();
    httpMock.expectOne('/api/favorites').flush({ favorites: [] });
    await Promise.resolve();

    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    const button = (fixture.nativeElement as HTMLElement).querySelector(
      'button',
    ) as HTMLButtonElement;
    expect(button.getAttribute('aria-pressed')).toBe('false');

    button.click();
    await fixture.whenStable();

    const req = httpMock.expectOne('/api/favorites');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ pokemonId: 25 });
    req.flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(TestBed.inject(FavoritesService).isFavorite(25)).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });
});
