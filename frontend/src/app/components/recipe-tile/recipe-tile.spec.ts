import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RecipeTile } from './recipe-tile';
import { PLATE_SRC } from '../../directives/img-fallback';
import { appTestProviders } from '../../../testing/providers';

describe('RecipeTile', () => {
  let fixture: ComponentFixture<RecipeTile>;
  const el = () => fixture.nativeElement as HTMLElement;

  const render = (recipe: object, index: number | null = null) => {
    fixture = TestBed.createComponent(RecipeTile);
    fixture.componentRef.setInput('recipe', recipe);
    fixture.componentRef.setInput('index', index);
    fixture.detectChanges();
  };

  beforeEach(() => TestBed.configureTestingModule({ imports: [RecipeTile], providers: appTestProviders }));

  it('links to the recipe, with a descriptive alt, title, numeral and only real metadata', () => {
    render({ _id: 'r1', name: 'Pad Thai', image: 'https://x/y.jpg', cuisine: 'Thai', mealType: ['Lunch'], prepTimeMinutes: 10, cookTimeMinutes: 5, difficulty: 'Easy' }, 2);

    expect(el().querySelector('a')!.getAttribute('href')).toBe('/view-recipe/r1');
    expect(el().querySelector('img')!.getAttribute('alt')).toBe('Pad Thai');
    expect(el().querySelector('.tile__title')!.textContent).toContain('Pad Thai');
    expect(el().querySelector('.tile__numeral')!.textContent!.trim()).toBe('03');
    expect(el().querySelector('.tile__meta')!.textContent).toContain('Thai · Lunch · 15 min · Easy');
  });

  it('omits the numeral and metadata that the record does not have', () => {
    render({ _id: 'r2', name: 'Plain', image: 'https://x/y.jpg' });
    expect(el().querySelector('.tile__numeral')).toBeNull();
    expect(el().querySelector('.tile__meta')).toBeNull();
  });

  it('shows the plate when there is no photo, and swaps to it if the photo fails to load', () => {
    render({ _id: 'r3', name: 'No photo' });
    expect(el().querySelector('img')!.getAttribute('src')).toBe(PLATE_SRC);

    render({ _id: 'r4', name: 'Broken', image: 'https://invalid.invalid/x.jpg' });
    const img = el().querySelector('img')!;
    img.dispatchEvent(new Event('error'));
    expect(img.getAttribute('src')).toBe(PLATE_SRC);
  });
});
