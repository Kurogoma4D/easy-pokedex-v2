import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { AuthUser } from '../features/auth/auth.model';
import { AuthService } from '../features/auth/auth.service';
import { Header } from './header';

class AuthServiceStub {
  readonly user = signal<AuthUser | null>(null);
  readonly initializing = signal(false);
  isAuthenticated = signal(false);
  logoutCalls = 0;

  logout(): Promise<void> {
    this.logoutCalls += 1;
    this.user.set(null);
    return Promise.resolve();
  }
}

describe('Header authentication entry points', () => {
  let auth: AuthServiceStub;

  beforeEach(async () => {
    localStorage.clear();
    auth = new AuthServiceStub();
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();
  });

  it('shows login and register links when signed out', async () => {
    const fixture = TestBed.createComponent(Header);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('a[href="/login"]')?.textContent).toContain('ログイン');
    expect(el.querySelector('a[href="/register"]')?.textContent).toContain('とうろく');
    expect(el.querySelector('.app-header__auth-action')).toBeNull();
  });

  it('shows the user email and a logout button when signed in', async () => {
    auth.user.set({ id: 1, email: 'me@example.com' });
    const fixture = TestBed.createComponent(Header);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.app-header__user')?.textContent).toContain('me@example.com');
    expect(el.querySelector('a[href="/login"]')).toBeNull();
    expect(el.querySelector('.app-header__auth-action')?.textContent).toContain('ログアウト');
  });

  it('invokes logout when the logout button is clicked', async () => {
    auth.user.set({ id: 1, email: 'me@example.com' });
    const fixture = TestBed.createComponent(Header);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector<HTMLButtonElement>('.app-header__auth-action')?.click();
    await fixture.whenStable();

    expect(auth.logoutCalls).toBe(1);
    expect(el.querySelector('a[href="/login"]')).not.toBeNull();
  });

  it('hides auth entry points until session restore finishes', async () => {
    auth.initializing.set(true);
    const fixture = TestBed.createComponent(Header);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.app-header__auth')).toBeNull();
  });
});
