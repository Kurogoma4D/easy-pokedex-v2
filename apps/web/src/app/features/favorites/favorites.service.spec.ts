import { provideHttpClient, withFetch } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_BASE_URL } from '../../core/api-base-url';
import { AuthService } from '../auth/auth.service';
import { FavoritesService } from './favorites.service';

describe('FavoritesService', () => {
  let service: FavoritesService;
  let auth: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withFetch()),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api' },
      ],
    });
    auth = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  /** AuthService の initializing/user を確定させ、追従 effect を走らせるための補助。 */
  async function signIn(): Promise<void> {
    const pending = auth.restoreSession();
    httpMock.expectOne('/api/auth/me').flush({ user: { id: 1, email: 'a@example.com' } });
    await pending;
  }

  async function signedOut(): Promise<void> {
    const pending = auth.restoreSession();
    httpMock
      .expectOne('/api/auth/me')
      .flush({ error: 'unauthenticated' }, { status: 401, statusText: 'Unauthorized' });
    await pending;
  }

  it('loads favorites with credentials once a user is signed in', async () => {
    await signIn();
    service = TestBed.inject(FavoritesService);
    TestBed.tick();

    const req = httpMock.expectOne('/api/favorites');
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ favorites: [{ pokemonId: 25 }, { pokemonId: 1 }] });
    await Promise.resolve();
    TestBed.tick();

    expect(service.isFavorite(25)).toBe(true);
    expect(service.isFavorite(1)).toBe(true);
    expect(service.isFavorite(2)).toBe(false);
  });

  it('does not call the API and stays empty when signed out', async () => {
    await signedOut();
    service = TestBed.inject(FavoritesService);
    TestBed.tick();

    httpMock.expectNone('/api/favorites');
    expect(service.ids()).toEqual([]);
  });

  it('optimistically adds a favorite and POSTs with credentials', async () => {
    await signIn();
    service = TestBed.inject(FavoritesService);
    TestBed.tick();
    httpMock.expectOne('/api/favorites').flush({ favorites: [] });
    await Promise.resolve();
    TestBed.tick();

    const pending = service.add(7);
    expect(service.isFavorite(7)).toBe(true);

    const req = httpMock.expectOne('/api/favorites');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ pokemonId: 7 });
    expect(req.request.withCredentials).toBe(true);
    req.flush(null, { status: 204, statusText: 'No Content' });
    await pending;

    expect(service.isFavorite(7)).toBe(true);
  });

  it('rolls back an add when the request fails', async () => {
    await signIn();
    service = TestBed.inject(FavoritesService);
    TestBed.tick();
    httpMock.expectOne('/api/favorites').flush({ favorites: [] });
    await Promise.resolve();
    TestBed.tick();

    const pending = service.add(7);
    expect(service.isFavorite(7)).toBe(true);
    httpMock
      .expectOne('/api/favorites')
      .flush({ error: 'boom' }, { status: 500, statusText: 'Server Error' });
    await pending;

    expect(service.isFavorite(7)).toBe(false);
  });

  it('optimistically removes a favorite and DELETEs the id', async () => {
    await signIn();
    service = TestBed.inject(FavoritesService);
    TestBed.tick();
    httpMock.expectOne('/api/favorites').flush({ favorites: [{ pokemonId: 4 }] });
    await Promise.resolve();
    TestBed.tick();
    expect(service.isFavorite(4)).toBe(true);

    const pending = service.remove(4);
    expect(service.isFavorite(4)).toBe(false);

    const req = httpMock.expectOne('/api/favorites/4');
    expect(req.request.method).toBe('DELETE');
    expect(req.request.withCredentials).toBe(true);
    req.flush(null, { status: 204, statusText: 'No Content' });
    await pending;

    expect(service.isFavorite(4)).toBe(false);
  });

  it('clears favorites when the user logs out', async () => {
    await signIn();
    service = TestBed.inject(FavoritesService);
    TestBed.tick();
    httpMock.expectOne('/api/favorites').flush({ favorites: [{ pokemonId: 9 }] });
    await Promise.resolve();
    TestBed.tick();
    expect(service.isFavorite(9)).toBe(true);

    const logout = auth.logout();
    httpMock.expectOne('/api/auth/logout').flush(null, { status: 204, statusText: 'No Content' });
    await logout;
    TestBed.tick();

    expect(service.ids()).toEqual([]);
  });
});
