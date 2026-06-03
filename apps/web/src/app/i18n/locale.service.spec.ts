import { TestBed } from '@angular/core/testing';
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY } from './locale';
import { LocaleService } from './locale.service';

describe('LocaleService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function createService(): LocaleService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(LocaleService);
  }

  it('defaults to ja when nothing is persisted', () => {
    const service = createService();
    expect(service.locale()).toBe(DEFAULT_LOCALE);
    expect(service.locale()).toBe('ja');
  });

  it('translates UI messages for the current locale', () => {
    const service = createService();
    expect(service.translate('nav.list')).toBe('一覧');
    service.setLocale('en');
    expect(service.translate('nav.list')).toBe('List');
  });

  it('toggles between ja and en', () => {
    const service = createService();
    service.toggleLocale();
    expect(service.locale()).toBe('en');
    service.toggleLocale();
    expect(service.locale()).toBe('ja');
  });

  it('persists the selected locale to localStorage', () => {
    const service = createService();
    service.setLocale('en');
    TestBed.tick();
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
  });

  it('restores a persisted locale on construction', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
    const service = createService();
    expect(service.locale()).toBe('en');
  });

  it('round-trips the selected locale across a fresh service instance', () => {
    const service = createService();
    service.setLocale('en');
    TestBed.tick();
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');

    // 新しいインスタンス（= リロード相当）が永続値から復元する。
    const restored = createService();
    expect(restored.locale()).toBe('en');
  });

  it('reflects the selected locale on the <html lang> attribute', () => {
    const service = createService();
    TestBed.tick();
    expect(document.documentElement.lang).toBe('ja');

    service.setLocale('en');
    TestBed.tick();
    expect(document.documentElement.lang).toBe('en');
  });

  it('ignores an invalid persisted value and falls back to default', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'fr');
    const service = createService();
    expect(service.locale()).toBe(DEFAULT_LOCALE);
  });

  it('localizes API-derived names for the current locale with fallback', () => {
    const service = createService();
    const name = { ja: 'フシギダネ', en: 'Bulbasaur' };
    expect(service.localizeName(name)).toBe('フシギダネ');
    service.setLocale('en');
    expect(service.localizeName(name)).toBe('Bulbasaur');
    expect(service.localizeName({ ja: 'のみ' })).toBe('のみ');
  });
});
