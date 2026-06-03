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
      gap: 1rem;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid currentColor;
    }
    .app-header__title {
      font-weight: bold;
      text-decoration: none;
      color: inherit;
    }
    .app-header__nav {
      display: flex;
      gap: 0.75rem;
      flex: 1;
    }
    .app-header__locale {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .is-active {
      font-weight: bold;
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
