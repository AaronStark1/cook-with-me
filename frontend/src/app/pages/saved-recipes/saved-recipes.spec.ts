import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { SavedRecipes } from './saved-recipes';
import { appTestProviders } from '../../../testing/providers';
import { environment } from '../../../environments/environment';

describe('SavedRecipes', () => {
  let component: SavedRecipes;
  let fixture: ComponentFixture<SavedRecipes>;
  let http: HttpTestingController;
  let el: HTMLElement;
  const listUrl = `${environment.apiUrl}/api/getSavedRecipes`;

  const saved = [
    { _id: 's1', recipeId: 'r1', name: 'Pad Thai', image: 'https://example.com/pad.jpg' },
    { _id: 's2', recipeId: 'r2', name: 'Carbonara', image: '' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SavedRecipes],
      providers: appTestProviders
    })
    .compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SavedRecipes);
    component = fixture.componentInstance;
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  afterEach(() => http.verify());

  it('should create', () => {
    http.expectOne(listUrl).flush([]);
    expect(component).toBeTruthy();
  });

  it('shows a loading state until the collection arrives', () => {
    expect(el.querySelector('.loader')).not.toBeNull();
    http.expectOne(listUrl).flush([]);
    fixture.detectChanges();
    expect(el.querySelector('.loader')).toBeNull();
  });

  it('shows a designed empty state with a way to browse recipes', () => {
    http.expectOne(listUrl).flush([]);
    fixture.detectChanges();

    expect(el.textContent).toContain('Nothing saved yet');
    expect(el.textContent).toContain("You haven't saved any recipes yet.");
    expect(el.querySelector('.saved__empty a')?.getAttribute('href')).toBe('/all-recipes');
  });

  it('renders each saved recipe as a linked tile with alt text and a labelled 44px remove button', () => {
    http.expectOne(listUrl).flush(saved);
    fixture.detectChanges();

    const tiles = el.querySelectorAll('.tile');
    expect(tiles.length).toBe(2);
    expect(el.querySelector('h1')?.textContent).toContain('Your Collections');
    expect(tiles[0].querySelector('a.tile__link')?.getAttribute('href')).toBe('/view-recipe/r1');
    expect(tiles[0].querySelector('img')?.getAttribute('alt')).toBe('Photo of Pad Thai');
    expect(tiles[0].querySelector('.tile__remove')?.getAttribute('aria-label')).toBe('Remove Pad Thai from your collection');
    // a recipe with no photo falls back to the local plate illustration
    expect(tiles[1].querySelector('img')?.getAttribute('src')).toContain('plate.svg');
  });

  it('re-fetches after a successful remove', () => {
    http.expectOne(listUrl).flush(saved);
    fixture.detectChanges();

    (el.querySelector('.tile__remove') as HTMLButtonElement).click();
    http.expectOne(`${environment.apiUrl}/api/deleteSavedRecipe/s1`).flush({});
    http.expectOne(listUrl).flush([saved[1]]);
    fixture.detectChanges();

    expect(el.querySelectorAll('.tile').length).toBe(1);
  });

  it('offers a retry when loading fails', () => {
    http.expectOne(listUrl).flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Could not load your collection');
    const retry = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Try again')) as HTMLButtonElement;
    retry.click();
    http.expectOne(listUrl).flush(saved);
    fixture.detectChanges();
    expect(el.querySelectorAll('.tile').length).toBe(2);
  });
});
