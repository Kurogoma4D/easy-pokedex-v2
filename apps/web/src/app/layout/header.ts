import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../features/auth/auth.service';
import { Locale } from '../i18n/locale';
import { LocaleService } from '../i18n/locale.service';
import { MessageKey } from '../i18n/messages';
import { Icon } from '../shared/icon/icon';
import { Logo } from '../shared/icon/logo';

/** ロケール切り替えボタンに使う、ロケールとその表示文言キーの対応。 */
const LOCALE_LABEL_KEYS: Readonly<Record<Locale, MessageKey>> = {
  ja: 'locale.ja',
  en: 'locale.en',
};

@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, Icon, Logo],
  template: `
    <header class="app-header">
      <a class="app-header__title" routerLink="/">
        <app-logo [label]="messages()['app.title']" />
      </a>
      <nav class="app-header__nav">
        <a routerLink="/list" routerLinkActive="is-active">{{ messages()['nav.list'] }}</a>
        @if (user()) {
          <a routerLink="/favorites" routerLinkActive="is-active">{{
            messages()['nav.favorites']
          }}</a>
        }
      </nav>
      @if (!initializing()) {
        <div class="app-header__auth">
          @if (user(); as currentUser) {
            <span class="app-header__user" title="{{ currentUser.email }}">{{
              currentUser.email
            }}</span>
            <button type="button" class="app-header__auth-action" (click)="logout()">
              {{ messages()['nav.logout'] }}
            </button>
          } @else {
            <a routerLink="/login" routerLinkActive="is-active">{{ messages()['nav.login'] }}</a>
            <a routerLink="/register" routerLinkActive="is-active">{{
              messages()['nav.register']
            }}</a>
          }
        </div>
      }
      <div
        class="app-header__locale"
        role="group"
        [attr.aria-label]="messages()['a11y.localeSwitch']"
      >
        <app-icon
          name="globe"
          [label]="messages()['locale.label']"
          class="app-header__locale-icon"
        />
        @for (option of localeOptions; track option.locale) {
          <button
            type="button"
            [class.is-active]="option.locale === currentLocale()"
            [attr.aria-pressed]="option.locale === currentLocale()"
            (click)="selectLocale(option.locale)"
          >
            {{ messages()[option.labelKey] }}
          </button>
        }
      </div>
    </header>
  `,
  styles: `
    .app-header {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
      margin-bottom: var(--space-3);
      color: var(--color-text-on-shell);
    }
    .app-header__title {
      display: inline-flex;
      font-size: var(--font-size-display-md);
      text-decoration: none;
      color: var(--color-text-on-shell);
    }
    .app-header__nav {
      display: flex;
      gap: var(--space-3);
      flex: 1;
      font-family: var(--font-display);
      font-size: var(--font-size-display-sm);
    }
    .app-header__nav a {
      color: var(--color-text-on-shell);
      text-decoration: none;
    }
    .app-header__auth {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-display);
      font-size: var(--font-size-display-sm);
    }
    .app-header__auth a {
      color: var(--color-text-on-shell);
      text-decoration: none;
    }
    .app-header__user {
      max-width: 12rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: var(--font-body);
      font-size: var(--font-size-body-sm);
      color: var(--color-text-on-shell);
    }
    .app-header__auth-action {
      font-family: inherit;
      font-size: inherit;
      color: var(--color-text-on-shell);
      background: transparent;
      border: 2px solid var(--color-text-on-shell);
      border-radius: var(--radius-chip);
      padding: var(--space-1) var(--space-2);
      cursor: pointer;
    }
    .app-header__locale {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-display);
      font-size: var(--font-size-display-sm);
    }
    .app-header__locale-icon {
      /* The globe sits one step up from the button label so it reads as a group
       * marker rather than competing with the language codes. */
      font-size: var(--font-size-display-md);
      color: var(--color-text-on-shell);
    }
    .is-active {
      text-decoration: underline;
      text-decoration-thickness: 2px;
      text-underline-offset: 3px;
    }
    .app-header__locale button.is-active {
      background-color: var(--color-text-on-shell);
      color: var(--color-text-inverse);
    }
  `,
})
export class Header {
  private readonly localeService = inject(LocaleService);
  private readonly authService = inject(AuthService);

  protected readonly messages = this.localeService.messages;
  protected readonly currentLocale = this.localeService.locale;
  protected readonly user = this.authService.user;
  protected readonly initializing = this.authService.initializing;
  protected readonly localeOptions = this.localeService.availableLocales.map((locale) => ({
    locale,
    labelKey: LOCALE_LABEL_KEYS[locale],
  }));

  protected selectLocale(locale: Locale): void {
    this.localeService.setLocale(locale);
  }

  protected logout(): void {
    void this.authService.logout();
  }
}
