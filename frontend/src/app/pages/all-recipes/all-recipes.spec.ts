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

  it('the head count follows the filters, with the real text as its accessible name', () => {
    load(DATA);
    const count = () => el().querySelector('.index-head__count app-odometer')!;
    expect(count().textContent!.trim()).toBe('4 recipes');
    chip('Thai', 'filter-cuisine').click();
    fixture.detectChanges();
    expect(count().textContent!.trim()).toBe('1 recipe');
    expect(count().querySelector('.odo')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('marks the search text inside matching titles', () => {
    load(DATA);
    fixture.componentInstance.searchKey = 'dish';
    fixture.detectChanges();
    const marks = Array.from(el().querySelectorAll('.tile__title mark')).map((m) => m.textContent);
    expect(marks).toEqual(['Dish', 'Dish', 'Dish', 'Dish']);
    expect(titles()).toEqual(['Dish 1', 'Dish 2', 'Dish 3', 'Dish 4']); // the title text itself is unchanged
  });

  it('"/" focuses the search box, but not while the user is typing in a field', () => {
    load(DATA);
    document.body.appendChild(el());
    const box = el().querySelector('#recipe-search') as HTMLInputElement;
    const slash = (target: EventTarget) => {
      const event = new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      return event;
    };
    expect(slash(document.body).defaultPrevented).toBeTrue();
    expect(document.activeElement).toBe(box);
    expect(slash(box).defaultPrevented).toBeFalse(); // a "/" typed into the box is just a character
    el().remove();
  });

  it('Escape clears the search, and a clear button appears only when there is text', async () => {
    load(DATA);
    const box = el().querySelector('#recipe-search') as HTMLInputElement;
    expect(el().querySelector('.index-search__clear')).toBeNull();
    box.value = 'dish 4';
    box.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el().querySelector('.index-search__clear')!.getAttribute('aria-label')).toBe('Clear search');

    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.searchKey).toBe('');
    expect(titles().length).toBe(4);
  });

  it('search examples come only from real cuisines and meal types', () => {
    load(DATA);
    expect((fixture.componentInstance as any).searchExamples).toEqual(['Thai', 'Thai-fusion', 'Italian', 'Lunch', 'Dinner', 'Snack']);
  });

  it('"Surprise me" is disabled with an explanation when nothing is visible', () => {
    load(DATA);
    const button = () => el().querySelector('.surprise') as HTMLButtonElement;
    expect(button().disabled).toBeFalse();
    fixture.componentInstance.searchKey = 'nothing like this';
    fixture.detectChanges();
    expect(button().disabled).toBeTrue();
    expect(button().getAttribute('aria-label')).toContain('no recipes to choose from');
  });

  it('shows skeleton tiles while loading, hidden from assistive tech, with a status text', () => {
    expect(el().querySelectorAll('.skeleton-tile').length).toBe(8);
    expect(el().querySelector('.skeleton-tile')!.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(el().querySelector('[role="status"]')!.textContent).toContain('Loading recipes');
    load([]);
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
