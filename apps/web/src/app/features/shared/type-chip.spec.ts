import { TestBed } from '@angular/core/testing';
import { LocaleService } from '../../i18n/locale.service';
import { TypeChip } from './type-chip';

describe('TypeChip', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [TypeChip],
    }).compileComponents();
  });

  it('renders the localized type name and binds the type accent token', async () => {
    const fixture = TestBed.createComponent(TypeChip);
    fixture.componentRef.setInput('type', 'grass');
    await fixture.whenStable();
    const chip = (fixture.nativeElement as HTMLElement).querySelector('.type-chip') as HTMLElement;

    expect(chip.textContent).toContain('くさ');
    expect(chip.style.getPropertyValue('--chip-fill')).toBe(
      'var(--type-grass, var(--color-surface-raised))',
    );
  });

  it('switches the label with the locale', async () => {
    const fixture = TestBed.createComponent(TypeChip);
    fixture.componentRef.setInput('type', 'fire');
    await fixture.whenStable();
    const chip = (fixture.nativeElement as HTMLElement).querySelector('.type-chip') as HTMLElement;

    expect(chip.textContent).toContain('ほのお');

    TestBed.inject(LocaleService).setLocale('en');
    await fixture.whenStable();

    expect(chip.textContent).toContain('Fire');
  });
});
