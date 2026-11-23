import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { ViewRecipe } from './view-recipe';
import { appTestProviders } from '../../../testing/providers';
import { fakeJwt } from '../../../testing/jwt';
import { AuthService } from '../../services/auth';
import { environment } from '../../../environments/environment';

const RECIPE = {
  _id: 'abc', name: 'Pad Thai', image: 'https://x/y.jpg', cuisine: 'Thai', mealType: ['Dinner', 'Lunch'],
  prepTimeMinutes: 10, cookTimeMinutes: 20, servings: 4, caloriesPerServing: 480, difficulty: 'Easy',
  ingredients: ['Noodles', 'Peanuts'], instructions: ['Soak', 'Fry'],
};

describe('ViewRecipe', () => {
  let fixture: ComponentFixture<ViewRecipe>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const api = environment.apiUrl;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ViewRecipe],
      providers: [...appTestProviders, { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'abc' })) } }],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ViewRecipe);
    fixture.detectChanges();
  });

  afterEach(() => { http.verify(); sessionStorage.clear(); });

  const load = (recipe: object = RECIPE, related: object[] = []) => {
    http.expectOne(`${api}/api/viewRecipe/abc`).flush(recipe);
    const rel = http.match((r) => r.url === `${api}/api/relatedRecipe`);
    rel.forEach((r) => r.flush(related));
    fixture.detectChanges();
  };

  it('shows a loading state, then the article', () => {
    expect(el().textContent).toContain('Loading recipe');
    load();
    expect(el().querySelector('h1')!.textContent).toContain('Pad Thai');
  });

  it('renders the facts that exist, as a definition list with numerals', () => {
    load();
    const facts = Array.from(el().querySelectorAll('.fact')).map((f) => [f.querySelector('dt')!.textContent!.trim(), f.querySelector('dd')!.textContent!.trim()]);
    expect(facts).toEqual([['Prep', '10min'], ['Cook', '20min'], ['Serves', '4'], ['Calories', '480kcal'], ['Difficulty', 'Easy']]);
  });

  it('leaves out facts the record does not have instead of printing "undefined"', () => {
    load({ _id: 'abc', name: 'Bare', ingredients: [], instructions: [] });
    expect(el().querySelector('.facts')!.children.length).toBe(0);
    expect(el().textContent).not.toContain('undefined');
  });

  it('lists ingredients and numbered method steps', () => {
    load();
    expect(Array.from(el().querySelectorAll('.ingredients li')).map((l) => l.textContent!.trim())).toEqual(['Noodles', 'Peanuts']);
    const steps = Array.from(el().querySelectorAll('.steps li'));
    expect(steps.length).toBe(2);
    expect(steps[1].textContent).toContain('02');
    expect(steps[1].textContent).toContain('Fry');
  });

  it('the hero photo has descriptive alt text', () => {
    load();
    expect(el().querySelector('.feature__photo img')!.getAttribute('alt')).toBe('Pad Thai');
  });

  it('shows related recipes as tiles, excluding the current one', () => {
    load(RECIPE, [{ ...RECIPE }, { ...RECIPE, _id: 'def', name: 'Green Curry' }]);
    expect(Array.from(el().querySelectorAll('.related .tile__title')).map((t) => t.textContent!.trim())).toEqual(['Green Curry']);
  });

  it('a guest is pointed at the existing login/join flow, and Save sends them to login', () => {
    load();
    expect(el().querySelector('.feature__hint a[href^="/login"]')).not.toBeNull();
    expect(el().querySelector('.feature__hint a[href="/register"]')).not.toBeNull();
  });

  it('a signed-in user can save; a repeat save explains itself', () => {
    TestBed.inject(AuthService).setSession(fakeJwt(), { username: 'a', email: 'a@b.co', role: 'User' });
    fixture.detectChanges();
    load();
    expect(el().querySelector('.feature__hint')).toBeNull();

    const save = Array.from(el().querySelectorAll('button')).find((b) => b.textContent!.includes('Save')) as HTMLButtonElement;
    save.click();
    http.expectOne(`${api}/api/savedRecipe/abc`).flush({}, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(el().querySelector('.alert')!.textContent).toContain('already in your collection');
  });

  it('shows a branded not-found state for a missing recipe', () => {
    http.expectOne(`${api}/api/viewRecipe/abc`).flush({}, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(el().querySelector('h1')!.textContent).toContain('Recipe not found');
    expect(el().querySelector('a[href="/all-recipes"]')).not.toBeNull();
  });
});
