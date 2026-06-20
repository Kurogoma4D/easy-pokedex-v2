import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import type { AuthActionResult } from './auth.service';
import { AuthService } from './auth.service';
import type { Credentials } from './auth.model';
import { Register } from './register';

class AuthServiceStub {
  registerResult: AuthActionResult = { ok: true };
  lastCredentials: Credentials | null = null;

  register(credentials: Credentials): Promise<AuthActionResult> {
    this.lastCredentials = credentials;
    return Promise.resolve(this.registerResult);
  }
}

describe('Register', () => {
  let auth: AuthServiceStub;

  beforeEach(async () => {
    localStorage.clear();
    auth = new AuthServiceStub();
    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();
  });

  function submit(fixture: { componentInstance: Register }, creds: Credentials): Promise<void> {
    return (
      fixture.componentInstance as unknown as { onSubmit(c: Credentials): Promise<void> }
    ).onSubmit(creds);
  }

  it('renders the register title and a link to login', async () => {
    const fixture = TestBed.createComponent(Register);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('a[href="/login"]')).not.toBeNull();
  });

  it('navigates to /list after a successful registration', async () => {
    const fixture = TestBed.createComponent(Register);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    await submit(fixture, { email: 'new@example.com', password: 'password123' });

    expect(auth.lastCredentials).toEqual({ email: 'new@example.com', password: 'password123' });
    expect(navigate).toHaveBeenCalledWith('/list');
  });

  it('shows an email-format error (not the password message) when the email is invalid', async () => {
    auth.registerResult = { ok: false, kind: 'validation_email' };
    const fixture = TestBed.createComponent(Register);

    await submit(fixture, { email: 'bad', password: 'password123' });
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    const text = el.querySelector('.auth-form__error')?.textContent ?? '';
    expect(text).toContain('メールアドレスの けいしきが ただしく ありません。');
    expect(text).not.toContain('8もじ');
  });

  it('shows a password-length error when the password is too short', async () => {
    auth.registerResult = { ok: false, kind: 'validation_password' };
    const fixture = TestBed.createComponent(Register);

    await submit(fixture, { email: 'new@example.com', password: 'short' });
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.auth-form__error')?.textContent).toContain('8もじ');
  });

  it('shows a duplicate-email error on a 409 registration', async () => {
    auth.registerResult = { ok: false, kind: 'duplicate' };
    const fixture = TestBed.createComponent(Register);

    await submit(fixture, { email: 'dup@example.com', password: 'password123' });
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.auth-form__error')?.textContent).toContain(
      'その メールアドレスは すでに とうろくずみです。',
    );
  });
});
