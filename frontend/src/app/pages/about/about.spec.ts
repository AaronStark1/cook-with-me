import { ComponentFixture, TestBed } from '@angular/core/testing';

import { About } from './about';
import { appTestProviders } from '../../../testing/providers';

describe('About', () => {
  let component: About;
  let fixture: ComponentFixture<About>;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [About],
      providers: appTestProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(About);
    component = fixture.componentInstance;
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('has exactly one h1 and keeps the existing story copy', () => {
    expect(el.querySelectorAll('h1').length).toBe(1);
    expect(el.textContent).toContain('CookWithMe started with a simple idea');
    expect(el.textContent).toContain('Helping you cook better, faster, and smarter every day.');
  });

  it('explains the three real steps with decorative numerals hidden from assistive tech', () => {
    expect(el.querySelectorAll('.how li').length).toBe(3);
    el.querySelectorAll('.numeral').forEach((n) => expect(n.getAttribute('aria-hidden')).toBe('true'));
  });

  it('links the call to action to the recipe index', () => {
    const cta = el.querySelector('.cta a') as HTMLAnchorElement;
    expect(cta.getAttribute('href')).toBe('/all-recipes');
  });

  it('uses no external images', () => {
    expect(el.querySelectorAll('img').length).toBe(0);
  });
});
