import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { LocaleService } from '../../i18n/locale.service';
import type { MessageKey } from '../../i18n/messages';
import { AuthForm } from './auth-form';
import type { Credentials } from './auth.model';
import { AuthService } from './auth.service';

/** 登録失敗種別をフロントの文言キーへ写像する。 */
const ERROR_KEYS: Readonly<
  Record<
    'validation_email' | 'validation_password' | 'validation' | 'duplicate' | 'unknown',
    MessageKey
  >
> = {
  validation_email: 'auth.error.emailInvalid',
  validation_password: 'auth.error.passwordTooShort',
  // フィールド不明のバリデーション失敗（details 無し）は入力未充足として扱う。
  validation: 'auth.error.required',
  duplicate: 'auth.error.duplicateEmail',
  unknown: 'auth.error.unknown',
};

/**
 * アカウント登録画面。共通フォームを用い、成功時はそのままログイン状態になり
 * （BFF が登録成功でセッション Cookie を発行する）、`redirect`（既定は一覧）へ遷移する。
 */
@Component({
  selector: 'app-register',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthForm, RouterLink],
  template: `
    <section class="auth-page">
      <app-auth-form
        titleKey="auth.register.title"
        submitKey="auth.register.submit"
        passwordAutocomplete="new-password"
        [pending]="pending()"
        [errorKey]="errorKey()"
        (submitted)="onSubmit($event)"
      />
      <p class="auth-page__alt">
        <a routerLink="/login">{{ messages()['auth.register.toLogin'] }}</a>
      </p>
    </section>
  `,
  styles: `
    .auth-page {
      padding: var(--space-3) 0;
    }
    .auth-page__alt {
      max-width: 24rem;
      margin: var(--space-3) auto 0;
      text-align: center;
    }
    .auth-page__alt a {
      color: var(--color-text);
    }
  `,
})
export class Register {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly localeService = inject(LocaleService);

  protected readonly messages = this.localeService.messages;

  /** 成功後の遷移先（`?redirect=` でルーティング入力として受け取る）。 */
  readonly redirect = input<string>();

  protected readonly pending = signal(false);
  protected readonly errorKey = signal<MessageKey | null>(null);

  protected async onSubmit(credentials: Credentials): Promise<void> {
    this.pending.set(true);
    this.errorKey.set(null);
    const result = await this.auth.register(credentials);
    this.pending.set(false);
    if (result.ok) {
      await this.router.navigateByUrl(this.safeRedirect());
      return;
    }
    // 登録で invalid_credentials は発生しない。万一来ても unknown に倒す。
    const kind = result.kind === 'invalid_credentials' ? 'unknown' : result.kind;
    this.errorKey.set(ERROR_KEYS[kind]);
  }

  /** オープンリダイレクトを避け、アプリ内パス（先頭 `/`・`//` でない）のみ許可する。 */
  private safeRedirect(): string {
    const target = this.redirect();
    if (target !== undefined && target.startsWith('/') && !target.startsWith('//')) {
      return target;
    }
    return '/list';
  }
}
