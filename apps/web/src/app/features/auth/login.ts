import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { LocaleService } from '../../i18n/locale.service';
import type { MessageKey } from '../../i18n/messages';
import { AuthForm } from './auth-form';
import type { Credentials } from './auth.model';
import { AuthService } from './auth.service';

/** 認証失敗種別をフロントの文言キーへ写像する。 */
const ERROR_KEYS: Readonly<Record<'validation' | 'invalid_credentials' | 'unknown', MessageKey>> = {
  validation: 'auth.error.required',
  invalid_credentials: 'auth.error.invalidCredentials',
  unknown: 'auth.error.unknown',
};

/**
 * ログイン画面。共通フォームに資格情報の取得を任せ、本コンポーネントは送信・
 * 状態（送信中・エラー）・成功後の遷移に専念する。`redirect` クエリで遷移先を
 * 指定でき、未指定なら一覧へ戻す（お気に入り操作からの誘導は Part 5 で利用する）。
 */
@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthForm, RouterLink],
  template: `
    <section class="auth-page">
      <app-auth-form
        titleKey="auth.login.title"
        submitKey="auth.login.submit"
        passwordAutocomplete="current-password"
        [pending]="pending()"
        [errorKey]="errorKey()"
        (submitted)="onSubmit($event)"
      />
      <p class="auth-page__alt">
        <a routerLink="/register">{{ messages()['auth.login.toRegister'] }}</a>
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
export class Login {
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
    const result = await this.auth.login(credentials);
    this.pending.set(false);
    if (result.ok) {
      await this.router.navigateByUrl(this.safeRedirect());
      return;
    }
    // ログインで duplicate は発生しない。万一来ても unknown に倒す。
    const kind = result.kind === 'duplicate' ? 'unknown' : result.kind;
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
