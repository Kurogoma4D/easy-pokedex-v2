import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LocaleService } from '../../i18n/locale.service';
import { MessageKey } from '../../i18n/messages';
import { AuthError, AuthService } from './auth.service';
import type { AuthErrorKind } from './auth.model';

/** 認証エラー種別を表示文言キーへ写像する。 */
const ERROR_KEYS: Readonly<Record<AuthErrorKind, MessageKey>> = {
  invalid_input: 'auth.error.invalidInput',
  invalid_credentials: 'auth.error.invalidCredentials',
  email_taken: 'auth.error.emailTaken',
  network: 'auth.error.network',
};

/** ログイン画面。成功時は `redirect` クエリ（無ければ一覧）へ戻す。 */
@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="auth">
      <h1 class="auth__title">{{ messages()['auth.login.title'] }}</h1>
      <form class="auth__form" (ngSubmit)="submit()">
        <label class="auth__field">
          <span>{{ messages()['auth.email'] }}</span>
          <input
            type="email"
            name="email"
            autocomplete="email"
            required
            [(ngModel)]="email"
            [disabled]="pending()"
          />
        </label>
        <label class="auth__field">
          <span>{{ messages()['auth.password'] }}</span>
          <input
            type="password"
            name="password"
            autocomplete="current-password"
            required
            [(ngModel)]="password"
            [disabled]="pending()"
          />
        </label>

        @if (errorKey(); as key) {
          <p class="auth__error" role="alert">{{ messages()[key] }}</p>
        }

        <button class="auth__submit" type="submit" [disabled]="pending()">
          {{ messages()['auth.login.submit'] }}
        </button>
      </form>
      <p class="auth__alt">
        {{ messages()['auth.login.toRegister'] }}
        <a routerLink="/register">{{ messages()['auth.register.title'] }}</a>
      </p>
    </section>
  `,
  styles: `
    .auth {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      max-width: 24rem;
      margin: 0 auto;
    }
    .auth__form {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .auth__field {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      font-family: var(--font-display);
      font-size: var(--font-size-display-sm);
    }
    .auth__field input {
      padding: var(--space-2);
      border: var(--border-width-chunky) solid var(--color-border);
      border-radius: var(--radius-chip);
    }
    .auth__error {
      margin: 0;
      color: var(--color-danger, crimson);
      font-family: var(--font-display);
      font-size: var(--font-size-display-sm);
    }
    .auth__submit {
      font-family: var(--font-display);
      font-size: var(--font-size-display-sm);
      padding: var(--space-2);
    }
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly localeService = inject(LocaleService);

  protected readonly messages = this.localeService.messages;

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly pending = signal(false);
  protected readonly errorKey = signal<MessageKey | null>(null);

  protected async submit(): Promise<void> {
    if (this.pending()) {
      return;
    }
    this.errorKey.set(null);
    this.pending.set(true);
    try {
      await this.auth.login(this.email(), this.password());
      const redirect = this.route.snapshot.queryParamMap.get('redirect');
      await this.router.navigateByUrl(redirect ?? '/list');
    } catch (error) {
      const kind: AuthErrorKind = error instanceof AuthError ? error.kind : 'network';
      this.errorKey.set(ERROR_KEYS[kind]);
    } finally {
      this.pending.set(false);
    }
  }
}
