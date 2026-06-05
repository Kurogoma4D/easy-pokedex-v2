import { provideHttpClient, withFetch } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_BASE_URL } from '../../core/api-base-url';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
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
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('starts unauthenticated', () => {
    expect(service.isAuthenticated()).toBe(false);
    expect(service.user()).toBeNull();
  });

  it('restores the current user from /auth/me and sends cookies', async () => {
    const pending = service.restoreSession();
    const req = httpMock.expectOne('/api/auth/me');
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ user: { id: 1, email: 'me@example.com' } });
    await pending;

    expect(service.isAuthenticated()).toBe(true);
    expect(service.user()?.email).toBe('me@example.com');
    expect(service.initializing()).toBe(false);
  });

  it('treats a 401 from /auth/me as unauthenticated', async () => {
    const pending = service.restoreSession();
    httpMock
      .expectOne('/api/auth/me')
      .flush({ error: 'authentication required' }, { status: 401, statusText: 'Unauthorized' });
    await pending;

    expect(service.isAuthenticated()).toBe(false);
    expect(service.initializing()).toBe(false);
  });

  it('logs in and stores the returned user', async () => {
    const pending = service.login({ email: 'a@example.com', password: 'password123' });
    const req = httpMock.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ user: { id: 2, email: 'a@example.com' } });

    const result = await pending;
    expect(result).toEqual({ ok: true });
    expect(service.user()?.email).toBe('a@example.com');
  });

  it('maps a 401 login to invalid_credentials and stays unauthenticated', async () => {
    const pending = service.login({ email: 'a@example.com', password: 'wrong' });
    httpMock
      .expectOne('/api/auth/login')
      .flush({ error: 'invalid email or password' }, { status: 401, statusText: 'Unauthorized' });

    const result = await pending;
    expect(result).toEqual({ ok: false, kind: 'invalid_credentials' });
    expect(service.isAuthenticated()).toBe(false);
  });

  it('maps a 400 with no field details to generic validation', async () => {
    const pending = service.login({ email: 'bad', password: 'short' });
    httpMock
      .expectOne('/api/auth/login')
      .flush({ error: 'invalid input', details: [] }, { status: 400, statusText: 'Bad Request' });

    const result = await pending;
    expect(result).toEqual({ ok: false, kind: 'validation' });
  });

  it('maps a 400 email-field error to validation_email', async () => {
    const pending = service.login({ email: 'bad', password: 'password123' });
    httpMock
      .expectOne('/api/auth/login')
      .flush(
        {
          error: 'invalid input',
          details: [{ field: 'email', message: 'email format is invalid' }],
        },
        { status: 400, statusText: 'Bad Request' },
      );

    const result = await pending;
    expect(result).toEqual({ ok: false, kind: 'validation_email' });
  });

  it('maps a 400 password-field error to validation_password', async () => {
    const pending = service.register({ email: 'a@example.com', password: 'short' });
    httpMock.expectOne('/api/auth/register').flush(
      {
        error: 'invalid input',
        details: [{ field: 'password', message: 'password must be at least 8 characters' }],
      },
      { status: 400, statusText: 'Bad Request' },
    );

    const result = await pending;
    expect(result).toEqual({ ok: false, kind: 'validation_password' });
  });

  it('prioritizes the email field when both email and password are invalid', async () => {
    const pending = service.register({ email: 'bad', password: 'short' });
    httpMock.expectOne('/api/auth/register').flush(
      {
        error: 'invalid input',
        details: [
          { field: 'email', message: 'email format is invalid' },
          { field: 'password', message: 'password must be at least 8 characters' },
        ],
      },
      { status: 400, statusText: 'Bad Request' },
    );

    const result = await pending;
    expect(result).toEqual({ ok: false, kind: 'validation_email' });
  });

  it('registers and stores the returned user', async () => {
    const pending = service.register({ email: 'new@example.com', password: 'password123' });
    const req = httpMock.expectOne('/api/auth/register');
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    req.flush(
      { user: { id: 3, email: 'new@example.com' } },
      { status: 201, statusText: 'Created' },
    );

    const result = await pending;
    expect(result).toEqual({ ok: true });
    expect(service.user()?.email).toBe('new@example.com');
  });

  it('maps a 409 register to duplicate', async () => {
    const pending = service.register({ email: 'dup@example.com', password: 'password123' });
    httpMock
      .expectOne('/api/auth/register')
      .flush({ error: 'email already registered' }, { status: 409, statusText: 'Conflict' });

    const result = await pending;
    expect(result).toEqual({ ok: false, kind: 'duplicate' });
    expect(service.isAuthenticated()).toBe(false);
  });

  it('clears the user on logout regardless of server response', async () => {
    const login = service.login({ email: 'a@example.com', password: 'password123' });
    httpMock.expectOne('/api/auth/login').flush({ user: { id: 4, email: 'a@example.com' } });
    await login;
    expect(service.isAuthenticated()).toBe(true);

    const pending = service.logout();
    const req = httpMock.expectOne('/api/auth/logout');
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    req.flush(null, { status: 204, statusText: 'No Content' });
    await pending;

    expect(service.isAuthenticated()).toBe(false);
    expect(service.user()).toBeNull();
  });
});
