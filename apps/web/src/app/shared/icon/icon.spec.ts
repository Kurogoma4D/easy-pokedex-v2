import { TestBed } from '@angular/core/testing';
import { ICON_PATHS } from './icon-defs';
import { Icon } from './icon';

describe('Icon', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Icon],
    }).compileComponents();
  });

  it('renders the requested icon path', async () => {
    const fixture = TestBed.createComponent(Icon);
    fixture.componentRef.setInput('name', 'search');
    await fixture.whenStable();
    const path = (fixture.nativeElement as HTMLElement).querySelector('path');

    expect(path?.getAttribute('d')).toBe(ICON_PATHS.search);
  });

  it('is decorative (aria-hidden, no role) when no label is given', async () => {
    const fixture = TestBed.createComponent(Icon);
    fixture.componentRef.setInput('name', 'filter');
    await fixture.whenStable();
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg') as SVGElement;

    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('role')).toBeNull();
    expect(svg.getAttribute('aria-label')).toBeNull();
  });

  it('exposes an accessible label when one is provided', async () => {
    const fixture = TestBed.createComponent(Icon);
    fixture.componentRef.setInput('name', 'globe');
    fixture.componentRef.setInput('label', 'Language');
    await fixture.whenStable();
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg') as SVGElement;

    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Language');
    expect(svg.getAttribute('aria-hidden')).toBeNull();
  });
});
