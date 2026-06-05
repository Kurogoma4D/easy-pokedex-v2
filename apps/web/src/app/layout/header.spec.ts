import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LocaleService } from '../i18n/locale.service';
import { Header } from './header';

describe('Header', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('renders navigation labels in the current locale and switches on toggle', async () => {
    const fixture = TestBed.createComponent(Header);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.app-header__nav')?.textContent).toContain('一覧');

    TestBed.inject(LocaleService).setLocale('en');
    await fixture.whenStable();

    expect(el.querySelector('.app-header__nav')?.textContent).toContain('List');
  });

  it('shows the brand logo wordmark and a labeled language-switch group', async () => {
    const fixture = TestBed.createComponent(Header);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('app-logo .logo__word')?.textContent).toContain('イージーポケモン図鑑');

    const group = el.querySelector('.app-header__locale');
    expect(group?.getAttribute('role')).toBe('group');
    expect(group?.getAttribute('aria-label')).toBe('言語の切り替え');
    expect(group?.querySelector('app-icon[name="globe"]')).not.toBeNull();
  });

  it('offers a button per locale and marks the active one as pressed', async () => {
    const fixture = TestBed.createComponent(Header);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    const buttons = [...el.querySelectorAll<HTMLButtonElement>('.app-header__locale button')];
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['日本語', 'English']);

    // 既定（ja）は ja ボタンだけが押下状態として示される。
    const [ja, en] = buttons;
    expect(ja.getAttribute('aria-pressed')).toBe('true');
    expect(en.getAttribute('aria-pressed')).toBe('false');
    expect(ja.classList.contains('is-active')).toBe(true);
    expect(en.classList.contains('is-active')).toBe(false);
  });

  it('moves the pressed indicator and updates the service when a locale is clicked', async () => {
    const fixture = TestBed.createComponent(Header);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    const en = [...el.querySelectorAll<HTMLButtonElement>('.app-header__locale button')].find((b) =>
      b.textContent?.includes('English'),
    ) as HTMLButtonElement;
    en.click();
    await fixture.whenStable();

    expect(en.getAttribute('aria-pressed')).toBe('true');
    expect(en.classList.contains('is-active')).toBe(true);
    expect(TestBed.inject(LocaleService).locale()).toBe('en');
  });
});
