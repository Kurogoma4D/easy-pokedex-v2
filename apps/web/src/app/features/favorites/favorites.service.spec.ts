import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../auth/auth.service';
import { FavoritesService } from './favorites.service';

describe('FavoritesService', () => {
  let service: FavoritesService;
  let auth: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    service = TestBed.inject(FavoritesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  async function login(): Promise<void> {
    const p = auth.login('a@b.com', 'password123');
    httpMock.expectOne('/api/auth/login').flush({ user: { id: 1, email: 'a@b.com' } });
    await p;
    // ログインの effect が発火させる初期一覧取得に応答する。
    await TestBed.tick();
    httpMock.expectOne('/api/favorites').flush({ pokemonIds: [3, 1] });
  }

  it('starts empty when logged out', () => {
    expect(service.ids().size).toBe(0);
    expect(service.orderedIds()).toEqual([]);
  });

  it('loads favorites on login', async () => {
    await login();
    expect(service.orderedIds()).toEqual([3, 1]);
    expect(service.ids().has(3)).toBe(true);
  });

  it('adds a favorite optimistically after the request resolves', async () => {
    await login();

    const add = service.add(25);
    const req = httpMock.expectOne('/api/favorites/25');
    expect(req.request.method).toBe('PUT');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ pokemonId: 25, favorite: true });
    await add;

    expect(service.ids().has(25)).toBe(true);
    expect(service.orderedIds()[0]).toBe(25);
  });

  it('removes a favorite', async () => {
    await login();

    const remove = service.remove(3);
    httpMock.expectOne('/api/favorites/3').flush({ pokemonId: 3, favorite: false });
    await remove;

    expect(service.ids().has(3)).toBe(false);
    expect(service.orderedIds()).toEqual([1]);
  });

  it('clears favorites on logout', async () => {
    await login();
    const logout = auth.logout();
    httpMock.expectOne('/api/auth/logout').flush(null, { status: 204, statusText: 'No Content' });
    await logout;
    await TestBed.tick();

    expect(service.ids().size).toBe(0);
    expect(service.orderedIds()).toEqual([]);
  });
});
