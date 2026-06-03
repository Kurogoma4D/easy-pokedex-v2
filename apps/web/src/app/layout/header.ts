import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Locale } from '../i18n/locale';
import { LocaleService } from '../i18n/locale.service';
import { MessageKey } from '../i18n/messages';

/** ロケール切り替えボタンに使う、ロケールとその表示文言キーの対応。 */
const LOCALE_LABEL_KEYS: Readonly<Record<Locale, MessageKey>> = {
  ja: 'locale.ja',
  en: 'locale.en',
};

@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="app-header">
      <a class="app-header__title" routerLink="/">{{ messages()['app.title'] }}</a>
      <nav class="app-header__nav">
        <a routerLink="/list" routerLinkActive="is-active">{{ messages()['nav.list'] }}</a>
      </nav>
      <div class="app-header__locale">
        <span>{{ messages()['locale.label'] }}</span>
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
      font-family: var(--font-display);
      font-size: var(--font-size-display-md);
      letter-spacing: var(--letter-spacing-display);
      text-decoration: none;
      color: var(--color-text-on-shell);
    }
    .app-header__title::before {
      /* The classic round power LED next to the dex name. */
      content: '';
      display: inline-block;
      width: var(--space-2);
      height: var(--space-2);
      margin-right: var(--space-2);
      border-radius: var(--radius-pill);
      background-color: var(--color-accent);
      box-shadow: 0 0 0 2px var(--bezel-0);
      vertical-align: middle;
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
    .app-header__locale {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-display);
      font-size: var(--font-size-display-sm);
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

  protected readonly messages = this.localeService.messages;
  protected readonly currentLocale = this.localeService.locale;
  protected readonly localeOptions = this.localeService.availableLocales.map((locale) => ({
    locale,
    labelKey: LOCALE_LABEL_KEYS[locale],
  }));

  protected selectLocale(locale: Locale): void {
    this.localeService.setLocale(locale);
  }
}
