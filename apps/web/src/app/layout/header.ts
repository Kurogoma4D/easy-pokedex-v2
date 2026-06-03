import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Locale } from '../i18n/locale';
import { LocaleService } from '../i18n/locale.service';
import { TranslatePipe } from '../i18n/translate.pipe';

@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  template: `
    <header class="app-header">
      <a class="app-header__title" routerLink="/">{{ 'app.title' | t }}</a>
      <nav class="app-header__nav">
        <a routerLink="/list" routerLinkActive="is-active">{{ 'nav.list' | t }}</a>
      </nav>
      <div class="app-header__locale">
        <span>{{ 'locale.label' | t }}</span>
        @for (locale of locales; track locale) {
          <button
            type="button"
            [class.is-active]="locale === currentLocale()"
            [attr.aria-pressed]="locale === currentLocale()"
            (click)="selectLocale(locale)"
          >
            {{ localeLabel(locale) | t }}
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

  protected readonly currentLocale = this.localeService.locale;
  protected readonly locales = this.localeService.availableLocales;

  protected selectLocale(locale: Locale): void {
    this.localeService.setLocale(locale);
  }

  protected localeLabel(locale: Locale): 'locale.ja' | 'locale.en' {
    return locale === 'ja' ? 'locale.ja' : 'locale.en';
  }
}
