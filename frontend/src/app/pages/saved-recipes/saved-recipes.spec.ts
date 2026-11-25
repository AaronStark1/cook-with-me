import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { SavedRecipes } from './saved-recipes';
import { ToastService } from '../../components/toasts/toast.service';
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

  describe('motion layer', () => {
    const saveUrl = (recipeId: string) => `${environment.apiUrl}/api/savedRecipe/${recipeId}`;
    const deleteUrl = (savedId: string) => `${environment.apiUrl}/api/deleteSavedRecipe/${savedId}`;
    let toasts: ToastService;

    beforeEach(() => {
      toasts = TestBed.inject(ToastService);
    });

    afterEach(() => toasts.toasts().forEach((toast) => toasts.dismiss(toast.id)));

    const names = () => [...el.querySelectorAll('.tile__link')].map((a) => a.textContent?.trim());

    it('keeps a tile until the delete has succeeded and the server list no longer has it', () => {
      http.expectOne(listUrl).flush(saved);
      fixture.detectChanges();

      (el.querySelector('.tile__remove') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(names()).toEqual(['Pad Thai', 'Carbonara']);
      expect(toasts.toasts().length).toBe(0);

      http.expectOne(deleteUrl('s1')).flush({});
      fixture.detectChanges();
      expect(names()).toEqual(['Pad Thai', 'Carbonara']);

      http.expectOne(listUrl).flush([saved[1]]);
      fixture.detectChanges();
      expect(names()).toEqual(['Carbonara']);
    });

    it('keeps the tile, shows the alert and offers no undo when the delete fails', () => {
      http.expectOne(listUrl).flush(saved);
      fixture.detectChanges();

      (el.querySelector('.tile__remove') as HTMLButtonElement).click();
      http.expectOne(deleteUrl('s1')).flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
      fixture.detectChanges();

      expect(names()).toEqual(['Pad Thai', 'Carbonara']);
      expect(el.querySelector('.alert-danger')?.textContent).toContain('Not found');
      expect(toasts.toasts().length).toBe(0);
    });

    it('gives the count as real text through the odometer label, and keeps it current', () => {
      http.expectOne(listUrl).flush(saved);
      fixture.detectChanges();

      const count = el.querySelector('.saved__count') as HTMLElement;
      const label = () => count.querySelector('app-odometer .visually-hidden')?.textContent?.trim();
      expect(label()).toBe('2 saved');
      expect(count.textContent).toContain('2 saved');
      expect(count.querySelector('.odo')?.getAttribute('aria-hidden')).toBe('true');
      // the visible word beside the digits is decoration: the label already says it
      expect(count.querySelector(':scope > span')?.getAttribute('aria-hidden')).toBe('true');

      (el.querySelector('.tile__remove') as HTMLButtonElement).click();
      http.expectOne(deleteUrl('s1')).flush({});
      http.expectOne(listUrl).flush([saved[1]]);
      fixture.detectChanges();
      expect(label()).toBe('1 saved');
    });

    it('rocks a decorative empty plate in the empty state', () => {
      http.expectOne(listUrl).flush([]);
      fixture.detectChanges();

      const plate = el.querySelector('.saved__empty .plate-rock') as HTMLElement;
      expect(plate.getAttribute('aria-hidden')).toBe('true');
      expect(el.querySelector('.saved__count')).toBeNull();
    });

    it('lets the grid animate removals (appFlip needs a positioned list)', () => {
      http.expectOne(listUrl).flush(saved);
      fixture.detectChanges();
      expect(getComputedStyle(el.querySelector('.saved__grid') as HTMLElement).position).toBe('relative');
    });

    it('offers Undo after a removal and re-saves by the recipe id, not the saved-record id', () => {
      http.expectOne(listUrl).flush(saved);
      fixture.detectChanges();

      (el.querySelector('.tile__remove') as HTMLButtonElement).click();
      http.expectOne(deleteUrl('s1')).flush({});
      http.expectOne(listUrl).flush([saved[1]]);
      fixture.detectChanges();

      const [toast] = toasts.toasts();
      expect(toast.text).toBe('Removed Pad Thai from your collection.');
      expect(toast.kind).toBe('status');
      expect(toast.action?.label).toBe('Undo');

      toast.action!.run();
      const request = http.expectOne(saveUrl('r1'));
      expect(request.request.method).toBe('POST');
      // nothing comes back until the server says so
      fixture.detectChanges();
      expect(names()).toEqual(['Carbonara']);

      request.flush({ message: 'Added to collection' }, { status: 201, statusText: 'Created' });
      http.expectOne(listUrl).flush([saved[1], { ...saved[0], _id: 's3' }]);
      fixture.detectChanges();
      expect(names()).toEqual(['Carbonara', 'Pad Thai']);
    });

    it('says so when Undo fails, and never shows the recipe as restored', () => {
      http.expectOne(listUrl).flush(saved);
      fixture.detectChanges();

      (el.querySelector('.tile__remove') as HTMLButtonElement).click();
      http.expectOne(deleteUrl('s1')).flush({});
      http.expectOne(listUrl).flush([saved[1]]);
      fixture.detectChanges();

      const [toast] = toasts.toasts();
      toast.action!.run();
      toasts.dismiss(toast.id); // what the toast stack does after running an action
      http.expectOne(saveUrl('r1')).flush({ message: 'Recipe not found' }, { status: 404, statusText: 'Not Found' });
      fixture.detectChanges();

      expect(names()).toEqual(['Carbonara']);
      const [error] = toasts.toasts();
      expect(error.kind).toBe('error');
      expect(error.text).toBe('Could not put Pad Thai back. Please try again.');
      expect(error.action).toBeUndefined();
    });

    it('shows the real list when Undo finds the recipe already saved again (409)', () => {
      http.expectOne(listUrl).flush(saved);
      fixture.detectChanges();

      (el.querySelector('.tile__remove') as HTMLButtonElement).click();
      http.expectOne(deleteUrl('s1')).flush({});
      http.expectOne(listUrl).flush([saved[1]]);
      fixture.detectChanges();

      const [toast] = toasts.toasts();
      toast.action!.run();
      toasts.dismiss(toast.id);
      http.expectOne(saveUrl('r1')).flush({ message: 'Already saved' }, { status: 409, statusText: 'Conflict' });
      http.expectOne(listUrl).flush(saved);
      fixture.detectChanges();

      expect(names()).toEqual(['Pad Thai', 'Carbonara']);
      expect(toasts.toasts().length).toBe(0);
    });
  });
});
