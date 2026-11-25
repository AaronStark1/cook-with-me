import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { Dashboard } from './dashboard';
import { appTestProviders } from '../../../testing/providers';
import { STAT_COUNT_MS } from './stat-count';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: appTestProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('Dashboard — motion', () => {
  let fixture: ComponentFixture<Dashboard>;
  const el = () => fixture.nativeElement as HTMLElement;
  const values = () => Array.from(el().querySelectorAll<HTMLElement>('.stat__value'));
  const nextFrames = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

  function load(reducedMotion = false) {
    if (reducedMotion) {
      spyOn(window, 'matchMedia').and.returnValue({ matches: true, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList);
    }
    fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    for (const req of TestBed.inject(HttpTestingController).match(() => true)) {
      const url = req.request.url;
      if (url.includes('getAllUsers')) req.flush([{}, {}, {}]);
      else if (url.includes('allRecipes')) req.flush({ response: [{}, {}] });
      else if (url.includes('getDownloadedRecipesList')) req.flush({ downloads: [{ recipeId: 'r1', name: 'Dal', cuisine: 'Indian', count: 7 }] });
      else req.flush({ allTestimony: [] });
    }
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Dashboard], providers: appTestProviders }).compileComponents();
  });

  it('counts the numerals up in one UI beat while the real values stay in the DOM', async () => {
    expect(STAT_COUNT_MS).toBeLessThanOrEqual(200);
    load();

    expect(values().map((value) => value.textContent?.trim())).toEqual(['3', '2', '7', '0']);
    expect(values()[0].classList).toContain('count-up');
    expect(values()[0].classList).toContain('is-counting');
    expect(values()[3].classList).not.toContain('count-up'); // nothing to count to

    // …and it always finishes on the true value
    await new Promise((resolve) => setTimeout(resolve, STAT_COUNT_MS + 180 + 250));
    await nextFrames();
    expect(el().querySelector('.is-counting')).toBeNull();
    expect(values()[2].dataset['count']).toBe('7');
  });

  it('arms the staggered reveal of the stat blocks', () => {
    load();
    const stats = el().querySelector<HTMLElement>('.stats')!;
    expect(stats.classList).toContain('rv--stagger');
    expect((stats.children[3] as HTMLElement).style.getPropertyValue('--i')).toBe('3');
  });

  it('animates nothing under reduced motion', async () => {
    load(true);
    await nextFrames();

    expect(el().querySelector('.rv')).toBeNull();
    expect(el().querySelector('.count-up')).toBeNull();
    expect(values().map((value) => value.textContent?.trim())).toEqual(['3', '2', '7', '0']);
  });
});
