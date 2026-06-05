import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { LocaleService } from '../../i18n/locale.service';
import type { MessageKey } from '../../i18n/messages';
import type { Credentials } from './auth.model';

/**
 * 登録・ログイン共通の資格情報フォーム。
 *
 * メール・パスワードの入力と送信ボタンを描画し、送信時に親へ `Credentials` を通知する。
 * 送信中は `pending` 入力で操作を抑止し、`errorKey` 入力でエラー文言を表示する。
 * 画面ごとのタイトル・ボタン文言・補助リンクは入力で差し替える（ロジックは共通化する）。
 */
@Component({
  selector: 'app-auth-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <form class="auth-form" (ngSubmit)="onSubmit()" novalidate>
      <h1 class="auth-form__title">{{ messages()[titleKey()] }}</h1>

      <label class="auth-form__field">
        <span class="auth-form__label">{{ messages()['auth.email.label'] }}</span>
        <input
          name="email"
          type="email"
          autocomplete="email"
          inputmode="email"
          [placeholder]="messages()['auth.email.placeholder']"
          [(ngModel)]="email"
          [disabled]="pending()"
          required
        />
      </label>

      <label class="auth-form__field">
        <span class="auth-form__label">{{ messages()['auth.password.label'] }}</span>
        <input
          name="password"
          type="password"
          [attr.autocomplete]="passwordAutocomplete()"
          [placeholder]="messages()['auth.password.placeholder']"
          [(ngModel)]="password"
          [disabled]="pending()"
          required
        />
        <span class="auth-form__hint">{{ messages()['auth.password.hint'] }}</span>
      </label>

      @if (errorKey() !== null) {
        <p class="auth-form__error" role="alert">{{ messages()[errorKey()!] }}</p>
      }

      <button class="auth-form__submit" type="submit" [disabled]="pending()">
        {{ pending() ? messages()['auth.submitting'] : messages()[submitKey()] }}
      </button>
    </form>
  `,
  styles: `
    .auth-form {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      max-width: 24rem;
      margin: 0 auto;
    }
    .auth-form__title {
      font-family: var(--font-display);
      font-size: var(--font-size-display-md);
      color: var(--color-text);
      margin: 0;
    }
    .auth-form__field {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }
    .auth-form__label {
      font-size: var(--font-size-body-sm);
      color: var(--color-text);
    }
    .auth-form__field input {
      padding: var(--space-2);
      border: 2px solid var(--color-border);
      border-radius: var(--radius-chip);
      background: var(--color-surface-raised);
      color: var(--color-text);
      font: inherit;
    }
    .auth-form__field input:focus-visible {
      outline: 3px solid var(--color-focus);
      outline-offset: 1px;
    }
    .auth-form__hint {
      font-size: var(--font-size-body-sm);
      color: var(--color-text-muted);
    }
    .auth-form__error {
      margin: 0;
      padding: var(--space-2);
      border: 2px solid var(--color-accent);
      border-radius: var(--radius-chip);
      color: var(--color-accent);
      font-size: var(--font-size-body-sm);
    }
    .auth-form__submit {
      padding: var(--space-2) var(--space-3);
      border: 2px solid var(--color-border);
      border-radius: var(--radius-chip);
      background: var(--color-text);
      color: var(--color-text-inverse);
      font-family: var(--font-display);
      cursor: pointer;
    }
    .auth-form__submit:disabled {
      cursor: progress;
      opacity: 0.6;
    }
  `,
})
export class AuthForm {
  private readonly localeService = inject(LocaleService);
  protected readonly messages = this.localeService.messages;

  /** 画面タイトルの文言キー（ログイン/登録で差し替える）。 */
  readonly titleKey = input.required<MessageKey>();
  /** 送信ボタンの文言キー。 */
  readonly submitKey = input.required<MessageKey>();
  /** パスワード入力の autocomplete 値（login は current-password, register は new-password）。 */
  readonly passwordAutocomplete = input<'current-password' | 'new-password'>('current-password');
  /** 送信中フラグ。true の間は入力・送信を抑止する。 */
  readonly pending = input(false);
  /** 表示するエラー文言キー。null なら非表示。 */
  readonly errorKey = input<MessageKey | null>(null);

  /** 送信時に資格情報を通知する。 */
  readonly submitted = output<Credentials>();

  protected readonly email = signal('');
  protected readonly password = signal('');

  protected onSubmit(): void {
    this.submitted.emit({ email: this.email().trim(), password: this.password() });
  }
}
