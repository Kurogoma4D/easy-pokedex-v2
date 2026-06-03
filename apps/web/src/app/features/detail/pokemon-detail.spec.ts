import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LocaleService } from '../../i18n/locale.service';
import { PokemonDetail } from './pokemon-detail';

describe('PokemonDetail', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [PokemonDetail],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders name, types, stats, abilities and the evolution chain', async () => {
    const fixture = TestBed.createComponent(PokemonDetail);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.detail__name')?.textContent).toContain('フシギダネ');
    expect(el.querySelectorAll('.detail__types app-type-chip').length).toBe(2);
    expect(el.querySelectorAll('.stats__row').length).toBe(6);
    expect(el.querySelectorAll('.abilities__item').length).toBe(2);
    expect(el.querySelectorAll('.evo__node').length).toBe(3);
  });

  it('marks the hidden ability', async () => {
    const fixture = TestBed.createComponent(PokemonDetail);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.abilities__hidden')).toBeTruthy();
  });

  it('exposes stats as accessible meters', async () => {
    const fixture = TestBed.createComponent(PokemonDetail);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const meter = el.querySelector('.stats__bar[role="meter"]');

    expect(meter?.getAttribute('aria-valuemax')).toBe('255');
    expect(meter?.getAttribute('aria-valuenow')).toBeTruthy();
    expect(meter?.getAttribute('aria-label')).toBeTruthy();
  });

  it('localizes names when the locale changes', async () => {
    const fixture = TestBed.createComponent(PokemonDetail);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    TestBed.inject(LocaleService).setLocale('en');
    await fixture.whenStable();

    expect(el.querySelector('.detail__name')?.textContent).toContain('Bulbasaur');
  });
});
