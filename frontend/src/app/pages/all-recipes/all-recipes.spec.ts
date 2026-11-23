import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { AllRecipes } from './all-recipes';
import { appTestProviders } from '../../../testing/providers';
import { environment } from '../../../environments/environment';

const mk = (n: number, cuisine: string, mealType: string[]) => ({ _id: `id${n}`, name: `Dish ${n}`, image: 'https://x/y.jpg', cuisine, mealType });
const DATA = [mk(1, 'Thai', ['Lunch']), mk(2, 'Thai-fusion', ['Dinner']), mk(3, 'Italian', ['Dinner', 'Lunch']), mk(4, 'Italian', ['Snack'])];

describe('AllRecipes', () => {
  let fixture: ComponentFixture<AllRecipes>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const titles = () => Array.from(el().querySelectorAll('.tile__title')).map((t) => t.textContent!.trim());
  const chip = (label: string, group: 'filter-cuisine' | 'filter-meal') =>
    Array.from(el().querySelectorAll(`[aria-labelledby="${group}"] .chip`)).find((c) => c.textContent!.trim() === label) as HTMLButtonElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AllRecipes], providers: appTestProviders }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AllRecipes);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const load = (recipes: object[]) => {
    http.expectOne(`${environment.apiUrl}/api/allRecipes`).flush({ response: recipes });
    fixture.detectChanges();
  };

  it('should create and show a loading state first', () => {
    expect(el().textContent).toContain('Loading recipes');
    load([]);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('lists every recipe with a count and one h1', () => {
    load(DATA);
    expect(titles().length).toBe(4);
    expect(el().querySelectorAll('h1').length).toBe(1);
    expect(el().querySelector('.index-head__count')!.textContent).toContain('4');
  });

  it('builds cuisine and meal filters from the data', () => {
    load(DATA);
    expect(Array.from(el().querySelectorAll('[aria-labelledby="filter-cuisine"] .chip')).map((c) => c.textContent!.trim())).toEqual(['Any', 'Thai', 'Thai-fusion', 'Italian']);
    expect(Array.from(el().querySelectorAll('[aria-labelledby="filter-meal"] .chip')).map((c) => c.textContent!.trim())).toEqual(['Any', 'Lunch', 'Dinner', 'Snack']);
  });

  it('cuisine filter is strict — "Thai" does not match "Thai-fusion" — and reports its pressed state', () => {
    load(DATA);
    chip('Thai', 'filter-cuisine').click();
    fixture.detectChanges();
    expect(titles()).toEqual(['Dish 1']);
    expect(chip('Thai', 'filter-cuisine').getAttribute('aria-pressed')).toBe('true');
    expect(chip('Any', 'filter-cuisine').getAttribute('aria-pressed')).toBe('false');
  });

  it('combines cuisine, meal type and search; clearing restores everything', () => {
    load(DATA);
    chip('Italian', 'filter-cuisine').click();
    chip('Dinner', 'filter-meal').click();
    fixture.detectChanges();
    expect(titles()).toEqual(['Dish 3']);

    fixture.componentInstance.searchKey = 'nothing like this';
    fixture.detectChanges();
    expect(el().textContent).toContain('No recipes match');

    (Array.from(el().querySelectorAll('button')).find((b) => b.textContent!.trim() === 'Clear filters') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(titles().length).toBe(4);
  });

  it('search narrows results live by name', async () => {
    load(DATA);
    const input = el().querySelector('#recipe-search') as HTMLInputElement;
    input.value = 'dish 4';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(titles()).toEqual(['Dish 4']);
  });

  it('announces the result count through a polite live region', () => {
    load(DATA);
    chip('Thai', 'filter-cuisine').click();
    fixture.detectChanges();
    const live = el().querySelector('[role="status"][aria-live="polite"]')!;
    expect(live.textContent).toContain('1 recipe');
    expect(live.textContent).toContain('Thai');
  });

  it('shows a designed empty state for an empty library', () => {
    load([]);
    expect(el().textContent).toContain('No recipes match');
    expect(el().textContent).toContain('no recipes in the library yet');
  });

  it('shows a designed error state with a working retry', () => {
    http.expectOne(`${environment.apiUrl}/api/allRecipes`).flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(el().textContent).toContain("We couldn't load recipes");
    (Array.from(el().querySelectorAll('button')).find((b) => b.textContent!.includes('Try again')) as HTMLButtonElement).click();
    load(DATA);
    expect(titles().length).toBe(4);
  });
});
