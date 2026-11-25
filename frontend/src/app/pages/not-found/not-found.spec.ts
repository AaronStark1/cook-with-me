import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

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

  it('offers "Surprise me" as a button (not a third link) and opens nothing until recipes have loaded', () => {
    const button = [...el.querySelectorAll('button')].find((b) => b.textContent!.includes('Surprise me')) as HTMLButtonElement;
    expect(button).toBeTruthy();
    button.click();
    fixture.detectChanges();
    expect(button.disabled).toBeTrue();
    expect(button.textContent).toContain('Finding one');
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((r) => r.url.endsWith('/api/allRecipes')).flush({ response: [] });
    fixture.detectChanges();
    expect(button.disabled).toBeFalse();
    expect(document.querySelector('dialog.spin')).toBeNull(); // an empty library opens no wheel
    http.verify();
  });

  it('hides the decorative 404 numerals from assistive technology', () => {
    expect(el.querySelector('.nf__code')?.getAttribute('aria-hidden')).toBe('true');
  });
});
