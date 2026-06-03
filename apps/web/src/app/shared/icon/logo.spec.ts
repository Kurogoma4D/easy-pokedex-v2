import { TestBed } from '@angular/core/testing';
import { Logo } from './logo';

describe('Logo', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Logo],
    }).compileComponents();
  });

  it('shows the wordmark label and a decorative mark', async () => {
    const fixture = TestBed.createComponent(Logo);
    fixture.componentRef.setInput('label', 'Easy Pokédex');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.logo__word')?.textContent).toContain('Easy Pokédex');
    expect(el.querySelector('.logo__mark')?.getAttribute('aria-hidden')).toBe('true');
  });
});
