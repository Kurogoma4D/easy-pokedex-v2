import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LocaleService } from '../../i18n/locale.service';
import { PokemonList } from './pokemon-list';

describe('PokemonList', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [PokemonList],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders the dex title and a grid of cards', async () => {
    const fixture = TestBed.createComponent(PokemonList);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.list__title')?.textContent).toContain('ずかん');
    expect(el.querySelectorAll('app-pokemon-card').length).toBeGreaterThan(0);
  });

  it('renders the embedded search/filter UI', async () => {
    const fixture = TestBed.createComponent(PokemonList);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('app-pokemon-search')).toBeTruthy();
  });

  it('filters the grid down when a name query excludes everything', async () => {
    const fixture = TestBed.createComponent(PokemonList);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const before = el.querySelectorAll('app-pokemon-card').length;

    const input = el.querySelector('.search__input') as HTMLInputElement;
    input.value = 'zzzzz-no-match';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(el.querySelectorAll('app-pokemon-card').length).toBe(0);
    expect(el.querySelector('.list__empty')).toBeTruthy();
    expect(before).toBeGreaterThan(0);
  });

  it('narrows the grid when a generation is selected', async () => {
    const fixture = TestBed.createComponent(PokemonList);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const before = el.querySelectorAll('app-pokemon-card').length;

    const select = el.querySelector('select') as HTMLSelectElement;
    select.value = 'generation-iii';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    const after = el.querySelectorAll('app-pokemon-card').length;
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(before);
  });

  it('localizes the title when the locale changes', async () => {
    const fixture = TestBed.createComponent(PokemonList);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    TestBed.inject(LocaleService).setLocale('en');
    await fixture.whenStable();

    expect(el.querySelector('.list__title')?.textContent).toContain('POKÉDEX');
  });
});
