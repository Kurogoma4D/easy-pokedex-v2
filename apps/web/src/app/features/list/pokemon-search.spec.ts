import { TestBed } from '@angular/core/testing';
import { PokemonSearch } from './pokemon-search';

describe('PokemonSearch', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [PokemonSearch],
    }).compileComponents();
  });

  it('renders the name input, generation select and a toggle per type', async () => {
    const fixture = TestBed.createComponent(PokemonSearch);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('input[type="search"]')).toBeTruthy();
    expect(el.querySelector('select')).toBeTruthy();
    expect(el.querySelectorAll('.search__type').length).toBe(18);
  });

  it('toggles a type selection and reflects it via aria-pressed', async () => {
    const fixture = TestBed.createComponent(PokemonSearch);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const firstToggle = el.querySelector('.search__type') as HTMLButtonElement;

    expect(firstToggle.getAttribute('aria-pressed')).toBe('false');
    firstToggle.click();
    await fixture.whenStable();

    expect(firstToggle.getAttribute('aria-pressed')).toBe('true');
    expect(fixture.componentInstance.selectedTypes().length).toBe(1);
  });

  it('clears all conditions on reset', async () => {
    const fixture = TestBed.createComponent(PokemonSearch);
    const instance = fixture.componentInstance;
    instance.name.set('pika');
    instance.selectedTypes.set(['fire']);
    instance.generation.set('generation-i');
    await fixture.whenStable();

    const reset = (fixture.nativeElement as HTMLElement).querySelector(
      '.search__reset',
    ) as HTMLButtonElement;
    reset.click();
    await fixture.whenStable();

    expect(instance.name()).toBe('');
    expect(instance.selectedTypes().length).toBe(0);
    expect(instance.generation()).toBe('');
  });
});
