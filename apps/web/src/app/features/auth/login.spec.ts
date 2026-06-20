import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import type { AuthActionResult } from './auth.service';
import { AuthService } from './auth.service';
import type { Credentials } from './auth.model';
import { Login } from './login';

class AuthServiceStub {
  loginResult: AuthActionResult = { ok: true };
  lastCredentials: Credentials | null = null;

  login(credentials: Credentials): Promise<AuthActionResult> {
    this.lastCredentials = credentials;
    return Promise.resolve(this.loginResult);
  }
}

describe('Login', () => {
  let auth: AuthServiceStub;

  beforeEach(async () => {
    localStorage.clear();
    auth = new AuthServiceStub();
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();
  });

  function submit(fixture: { componentInstance: Login }, creds: Credentials): Promise<void> {
    // テンプレートの (submitted) ハンドラに相当する protected メソッドを呼ぶ。
    return (
      fixture.componentInstance as unknown as { onSubmit(c: Credentials): Promise<void> }
    ).onSubmit(creds);
  }

  it('renders the login title and a link to register', async () => {
    const fixture = TestBed.createComponent(Login);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.auth-form__title')?.textContent).toContain('ログイン');
    expect(el.querySelector('a[href="/register"]')).not.toBeNull();
  });

  it('navigates to /list after a successful login', async () => {
    const fixture = TestBed.createComponent(Login);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    await submit(fixture, { email: 'a@example.com', password: 'password123' });

    expect(auth.lastCredentials).toEqual({ email: 'a@example.com', password: 'password123' });
    expect(navigate).toHaveBeenCalledWith('/list');
  });

  it('shows an invalid-credentials error on a 401 login', async () => {
    auth.loginResult = { ok: false, kind: 'invalid_credentials' };
    const fixture = TestBed.createComponent(Login);

    await submit(fixture, { email: 'a@example.com', password: 'wrong' });
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.auth-form__error')?.textContent).toContain(
      'メールアドレスか パスワードが ちがいます。',
    );
  });

  it('shows an email-format error when validation fails on the email field', async () => {
    auth.loginResult = { ok: false, kind: 'validation_email' };
    const fixture = TestBed.createComponent(Login);

    await submit(fixture, { email: 'bad', password: 'password123' });
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.auth-form__error')?.textContent).toContain(
      'メールアドレスの けいしきが ただしく ありません。',
    );
  });

  it('redirects to a safe in-app target when provided', async () => {
    const fixture = TestBed.createComponent(Login);
    fixture.componentRef.setInput('redirect', '/detail/25');
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    await submit(fixture, { email: 'a@example.com', password: 'password123' });

    expect(navigate).toHaveBeenCalledWith('/detail/25');
  });

  it('ignores an external redirect target and falls back to /list', async () => {
    const fixture = TestBed.createComponent(Login);
    fixture.componentRef.setInput('redirect', '//evil.example.com');
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    await submit(fixture, { email: 'a@example.com', password: 'password123' });

    expect(navigate).toHaveBeenCalledWith('/list');
  });
});
