import { ComponentFixture, TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { RecipeList } from './recipe-list';
import { appTestProviders } from '../../../testing/providers';
import { ROW_OUT_MS } from '../row-motion';

describe('RecipeList', () => {
  let component: RecipeList;
  let fixture: ComponentFixture<RecipeList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecipeList],
      providers: appTestProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecipeList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('RecipeList — deleting a row', () => {
  let fixture: ComponentFixture<RecipeList>;
  let http: HttpTestingController;

  const recipes = () => [
    { _id: 'a', name: 'Dal', cuisine: 'Indian', image: '' },
    { _id: 'b', name: 'Ramen', cuisine: 'Japanese', image: '' },
    { _id: 'c', name: 'Tacos', cuisine: 'Mexican', image: '' },
  ];
  const el = () => fixture.nativeElement as HTMLElement;
  const rows = () => Array.from(el().querySelectorAll<HTMLTableRowElement>('tbody tr'));
  const names = () => rows().map((row) => row.cells[1].textContent?.trim());
  const deleteButton = (name: string) => el().querySelector<HTMLButtonElement>(`button[aria-label="Delete ${name}"]`)!;
  const expectList = () => http.expectOne((req) => req.method === 'GET' && req.url.includes('/api/allRecipes'));
  const expectDelete = (id: string) => http.expectOne((req) => req.method === 'DELETE' && req.url.endsWith(`/api/deleteRecipe/${id}`));

  /** Call inside fakeAsync so the component's timers are virtual. */
  function load(reducedMotion = false) {
    if (reducedMotion) {
      spyOn(window, 'matchMedia').and.returnValue({ matches: true, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList);
    }
    fixture = TestBed.createComponent(RecipeList);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    expectList().flush({ response: recipes() });
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RecipeList], providers: appTestProviders }).compileComponents();
  });

  it('keeps the row until the API succeeds, wipes it out, then removes it and refreshes', fakeAsync(() => {
    load();
    const confirmSpy = spyOn(window, 'confirm').and.returnValue(true);

    deleteButton('Ramen').click();
    fixture.detectChanges();
    expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete this recipe?');

    // request in flight: nothing optimistic — the row is there and is not leaving
    expect(names()).toEqual(['Dal', 'Ramen', 'Tacos']);
    expect(el().querySelector('tr.is-leaving')).toBeNull();

    expectDelete('b').flush({});
    fixture.detectChanges();
    expect(names()).toEqual(['Dal', 'Ramen', 'Tacos']);
    expect(rows()[1].classList).toContain('is-leaving');
    expect(rows()[0].classList).not.toContain('is-leaving');

    // a second press while it wipes out must not ask or call again
    deleteButton('Ramen').click();
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    http.expectNone((req) => req.method === 'DELETE');

    tick(ROW_OUT_MS - 1);
    fixture.detectChanges();
    expect(names()).toEqual(['Dal', 'Ramen', 'Tacos']);

    tick(1);
    fixture.detectChanges();
    expect(names()).toEqual(['Dal', 'Tacos']);
    expect(el().querySelector('tr.is-leaving')).toBeNull();

    // the list is still refreshed from the server, as before
    expectList().flush({ response: recipes().filter((recipe) => recipe._id !== 'b') });
    fixture.detectChanges();
    expect(names()).toEqual(['Dal', 'Tacos']);
    http.verify();
    flush();
  }));

  it('removes the row immediately under reduced motion (still only after success)', fakeAsync(() => {
    load(true);
    spyOn(window, 'confirm').and.returnValue(true);

    expect(el().querySelector('tbody')!.classList).not.toContain('rows-in');

    deleteButton('Dal').click();
    fixture.detectChanges();
    expect(names()).toEqual(['Dal', 'Ramen', 'Tacos']);

    expectDelete('a').flush({});
    fixture.detectChanges();
    expect(names()).toEqual(['Ramen', 'Tacos']);
    expect(el().querySelector('tr.is-leaving')).toBeNull();

    expectList().flush({ response: recipes().filter((recipe) => recipe._id !== 'a') });
    http.verify();
    flush();
  }));

  it('leaves the row alone and shows the error when the API fails', fakeAsync(() => {
    load();
    spyOn(window, 'confirm').and.returnValue(true);

    deleteButton('Tacos').click();
    expectDelete('c').flush({ message: 'Nope' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    tick(ROW_OUT_MS);
    fixture.detectChanges();

    expect(names()).toEqual(['Dal', 'Ramen', 'Tacos']);
    expect(el().querySelector('tr.is-leaving')).toBeNull();
    expect(el().querySelector('.alert-danger')?.textContent).toContain('Nope');
    http.verify();
    flush();
  }));

  it('does nothing when the confirmation is declined', fakeAsync(() => {
    load();
    spyOn(window, 'confirm').and.returnValue(false);

    deleteButton('Dal').click();
    fixture.detectChanges();

    http.expectNone((req) => req.method === 'DELETE');
    expect(names()).toEqual(['Dal', 'Ramen', 'Tacos']);
    expect(el().querySelector('tr.is-leaving')).toBeNull();
    flush();
  }));

  it('arms the row arrival once the table renders', fakeAsync(() => {
    load();
    expect(el().querySelector('tbody')!.classList).toContain('rows-in');
    flush();
    expect(el().querySelector('tbody')!.classList).not.toContain('rows-in');
  }));
});
