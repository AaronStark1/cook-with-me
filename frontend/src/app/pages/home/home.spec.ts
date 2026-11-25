import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { Home } from './home';
import { appTestProviders } from '../../../testing/providers';
import { environment } from '../../../environments/environment';

const recipe = (n: number) => ({
  _id: `id${n}`, name: `Recipe ${n}`, image: `https://example.com/${n}.jpg`, cuisine: 'Italian',
  mealType: ['Dinner'], prepTimeMinutes: 10, cookTimeMinutes: 5, difficulty: 'Easy',
});

describe('Home', () => {
  let fixture: ComponentFixture<Home>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const api = environment.apiUrl;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({ imports: [Home], providers: appTestProviders }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const flush = (recipes: object[] | null, testimonies: object[] = []) => {
    const r = http.expectOne(`${api}/api/allRecipes`);
    recipes === null ? r.flush({}, { status: 500, statusText: 'Server Error' }) : r.flush({ response: recipes });
    http.expectOne(`${api}/api/getApprovedTestimony`).flush({ approved: testimonies });
    fixture.detectChanges();
  };

  it('should create', () => {
    flush([]);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('feeds the hero carousel from real recipe data and links to real recipe pages', () => {
    flush([1, 2, 3, 4, 5, 6, 7].map(recipe));
    expect(el().querySelectorAll('.hero .dish img').length).toBe(5);
    expect(el().querySelector('.hero__info a')!.getAttribute('href')).toBe('/view-recipe/id1');
  });

  it('continues the editorial band after the hero recipes, so they do not repeat', () => {
    flush([1, 2, 3, 4, 5, 6, 7].map(recipe));
    const titles = Array.from(el().querySelectorAll('.recipes__grid .tile__title')).map((t) => t.textContent!.trim());
    expect(titles).toEqual(['Recipe 6', 'Recipe 7']);
  });

  it('reuses the library when it is small, and skips recipes without a photo in the hero', () => {
    flush([{ ...recipe(1), image: '' }, recipe(2)]);
    expect(el().querySelectorAll('.recipes__grid app-recipe-tile').length).toBe(2);
    expect(el().querySelectorAll('.hero .dish img').length).toBe(1); // one featured → one dish
    expect(el().querySelector('.hero .dish img')!.getAttribute('alt')).toBe('Recipe 2');
  });

  it('shows a designed error state with retry, and the hero stays usable', () => {
    flush(null);
    expect(el().textContent).toContain("We couldn't load recipes");
    expect(el().querySelector('h1')).not.toBeNull();
    (Array.from(el().querySelectorAll('button')).find((b) => b.textContent!.includes('Try again')) as HTMLButtonElement).click();
    http.expectOne(`${api}/api/allRecipes`).flush({ response: [recipe(1)] });
    fixture.detectChanges();
    expect(el().textContent).not.toContain("We couldn't load recipes");
  });

  it('renders approved testimonials as quotes, and a prompt when there are none', () => {
    flush([], [{ _id: 't1', message: 'Loved it', username: 'Maya', profession: 'Cook' }]);
    expect(el().querySelector('blockquote')!.textContent).toContain('Loved it');
    expect(el().querySelector('figcaption')!.textContent).toContain('Maya');
  });

  it('invites the first testimony when none are approved', () => {
    flush([]);
    expect(el().textContent).toContain('Be the first to share');
    expect(el().querySelector('a[href="/contact"]')).not.toBeNull();
  });

  it('reserves no Assembly Demo slot when no recipe is eligible for it — no gap, no dead UI', () => {
    flush([1, 2, 3].map(recipe)); // these records have no ingredients / instructions
    expect(el().querySelector('.demo-slot')).toBeNull();
    expect(el().querySelector('app-assembly-demo')).toBeNull();
  });

  it('reserves the Assembly Demo slot (with its item count) when recipes are eligible', () => {
    const full = (n: number) => ({ ...recipe(n), cuisine: `C${n}`, ingredients: ['a', 'b', 'c'], instructions: ['x', 'y', 'z'] });
    flush([1, 2, 3, 4, 5, 6, 7].map(full));
    const slot = el().querySelector('.demo-slot') as HTMLElement;
    expect(slot).not.toBeNull();
    expect(slot.style.getPropertyValue('--n')).toBe('3');
    // 6 and 7 first (the hero already features 1–5); a hero recipe only fills the last place
    expect(fixture.componentInstance.showcase.map((r) => r._id)).toEqual(['id6', 'id7', 'id1']);
  });

  it('has the right call to action for guests', () => {
    flush([]);
    expect(el().querySelector('.cta a')!.getAttribute('href')).toBe('/register');
  });
});
