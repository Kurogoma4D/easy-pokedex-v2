import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthForm } from './auth-form';
import type { Credentials } from './auth.model';

@Component({
  imports: [AuthForm],
  template: `
    <app-auth-form
      titleKey="auth.login.title"
      submitKey="auth.login.submit"
      [pending]="pending()"
      [errorKey]="errorKey()"
      (submitted)="onSubmitted($event)"
    />
  `,
})
class HostComponent {
  readonly pending = signal(false);
  readonly errorKey = signal<'auth.error.required' | null>(null);
  submitted: Credentials | null = null;

  onSubmitted(credentials: Credentials): void {
    this.submitted = credentials;
  }
}

describe('AuthForm', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
  });

  it('emits trimmed credentials on submit', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    const email = el.querySelector<HTMLInputElement>('input[name="email"]')!;
    const password = el.querySelector<HTMLInputElement>('input[name="password"]')!;
    email.value = '  a@example.com  ';
    email.dispatchEvent(new Event('input'));
    password.value = 'password123';
    password.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(fixture.componentInstance.submitted).toEqual({
      email: 'a@example.com',
      password: 'password123',
    });
  });

  it('disables inputs and the submit button while pending', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.pending.set(true);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector<HTMLInputElement>('input[name="email"]')!.disabled).toBe(true);
    expect(el.querySelector<HTMLButtonElement>('.auth-form__submit')!.disabled).toBe(true);
    expect(el.querySelector('.auth-form__submit')?.textContent).toContain('そうしんちゅう');
  });

  it('renders the error message when an error key is set', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.errorKey.set('auth.error.required');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.auth-form__error')?.textContent).toContain(
      'メールアドレスと パスワードを にゅうりょくして ください。',
    );
  });
});
