import { computed, effect, Injectable, signal } from '@angular/core';
import { DEFAULT_LOCALE, isLocale, Locale, LOCALE_STORAGE_KEY, LOCALES } from './locale';
import { LocalizedName, resolveLocalizedName } from './localized-name';
import { MessageKey, MESSAGES } from './messages';

@Injectable({ providedIn: 'root' })
export class LocaleService {
  private readonly _locale = signal<Locale>(this.restoreLocale());

  /** 現在の選択ロケール。 */
  readonly locale = this._locale.asReadonly();

  /** 選択可能なロケール一覧。 */
  readonly availableLocales = LOCALES;

  /**
   * 現在ロケールの UI 文言辞書。
   * テンプレートは `messages()['nav.list']` の形で signal を直接参照し、
   * ロケール signal の変更に追従して再評価される。
   */
  readonly messages = computed(() => MESSAGES[this._locale()]);

  constructor() {
    // ロケール変更を localStorage と <html lang> に反映する。
    effect(() => {
      const locale = this._locale();
      this.persistLocale(locale);
      if (typeof document !== 'undefined') {
        document.documentElement.lang = locale;
      }
    });
  }

  setLocale(locale: Locale): void {
    this._locale.set(locale);
  }

  toggleLocale(): void {
    this._locale.update((current) => (current === 'ja' ? 'en' : 'ja'));
  }

  /** UI 文言を現在ロケールで取得する。 */
  translate(key: MessageKey): string {
    return this.messages()[key];
  }

  /** API 由来の固有名詞を現在ロケールの表記へ解決する。 */
  localizeName(name: LocalizedName): string {
    return resolveLocalizedName(name, this._locale(), DEFAULT_LOCALE);
  }

  private restoreLocale(): Locale {
    if (typeof localStorage === 'undefined') {
      return DEFAULT_LOCALE;
    }
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : DEFAULT_LOCALE;
  }

  private persistLocale(locale: Locale): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }
}
