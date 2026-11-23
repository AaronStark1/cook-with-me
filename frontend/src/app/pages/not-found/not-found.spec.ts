import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NotFound } from './not-found';
import { appTestProviders } from '../../../testing/providers';

describe('NotFound', () => {
  let fixture: ComponentFixture<NotFound>;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotFound],
      providers: appTestProviders
    }).compileComponents();

    fixture = TestBed.createComponent(NotFound);
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('has a single h1 and routes people back home or to the recipes', () => {
    expect(el.querySelectorAll('h1').length).toBe(1);
    expect(el.querySelector('h1')?.textContent).toContain('Page not found');
    const hrefs = [...el.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/', '/all-recipes']);
  });

  it('hides the decorative 404 numerals from assistive technology', () => {
    expect(el.querySelector('.nf__code')?.getAttribute('aria-hidden')).toBe('true');
  });
});
