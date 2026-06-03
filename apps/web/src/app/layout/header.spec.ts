import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LocaleService } from '../i18n/locale.service';
import { Header } from './header';

describe('Header', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [provideRouter([])],
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
});
