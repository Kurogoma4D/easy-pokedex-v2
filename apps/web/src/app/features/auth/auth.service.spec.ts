import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthError, AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('logs in and exposes the current user', async () => {
    const login = service.login('a@b.com', 'password123');
    const req = httpMock.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ user: { id: 1, email: 'a@b.com' } });
    await login;

    expect(service.user()?.email).toBe('a@b.com');
  });

  it('maps a 409 register response to email_taken', async () => {
    const register = service.register('a@b.com', 'password123');
    const req = httpMock.expectOne('/api/auth/register');
    req.flush({ error: 'email already registered' }, { status: 409, statusText: 'Conflict' });

    await expect(register).rejects.toBeInstanceOf(AuthError);
    expect(service.user()).toBeNull();
  });

  it('maps a 401 login response to invalid_credentials', async () => {
    const login = service.login('a@b.com', 'wrongpassword');
    httpMock
      .expectOne('/api/auth/login')
      .flush({ error: 'invalid credentials' }, { status: 401, statusText: 'Unauthorized' });

    await login.catch((error: unknown) => {
      expect(error).toBeInstanceOf(AuthError);
      expect((error as AuthError).kind).toBe('invalid_credentials');
    });
  });

  it('clears the user on logout', async () => {
    const login = service.login('a@b.com', 'password123');
    httpMock.expectOne('/api/auth/login').flush({ user: { id: 1, email: 'a@b.com' } });
    await login;

    const logout = service.logout();
    httpMock.expectOne('/api/auth/logout').flush(null, { status: 204, statusText: 'No Content' });
    await logout;

    expect(service.user()).toBeNull();
  });

  it('restores the session from /auth/me', async () => {
    const restore = service.restoreSession();
    httpMock.expectOne('/api/auth/me').flush({ user: { id: 2, email: 'me@b.com' } });
    await restore;

    expect(service.user()?.id).toBe(2);
    expect(service.initialized()).toBe(true);
  });
});
