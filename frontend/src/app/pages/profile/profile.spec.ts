import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { Profile } from './profile';
import { appTestProviders } from '../../../testing/providers';
import { fakeJwt } from '../../../testing/jwt';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth';

describe('Profile', () => {
  let component: Profile;
  let fixture: ComponentFixture<Profile>;
  let http: HttpTestingController;
  let el: HTMLElement;
  const downloadsUrl = `${environment.apiUrl}/api/getDownload`;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Profile],
      providers: appTestProviders
    })
    .compileComponents();

    TestBed.inject(AuthService).setSession(fakeJwt(), { username: 'chef', email: 'chef@example.com', role: 'User' });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Profile);
    component = fixture.componentInstance;
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  it('should create', () => {
    http.expectOne(downloadsUrl).flush([]);
    expect(component).toBeTruthy();
  });

  it('shows a square initial avatar for the saved account name', () => {
    http.expectOne(downloadsUrl).flush([]);
    fixture.detectChanges();

    const avatar = el.querySelector('.profile__avatar') as HTMLElement;
    expect(avatar.textContent?.trim()).toBe('C');
    expect(avatar.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelectorAll('h1').length).toBe(1);
  });

  it('prefills the form and validates inline', () => {
    http.expectOne(downloadsUrl).flush([]);
    expect((el.querySelector('#username') as HTMLInputElement).value).toBe('chef');
    expect((el.querySelector('#email') as HTMLInputElement).value).toBe('chef@example.com');

    component.profileForm.setValue({ username: '', email: 'nope' });
    component.updateProfile();
    fixture.detectChanges();

    expect(el.querySelectorAll('.is-invalid').length).toBe(2);
    http.expectNone(`${environment.apiUrl}/api/updateProfile`);
  });

  it('shows a designed empty state when nothing has been downloaded', () => {
    http.expectOne(downloadsUrl).flush([]);
    fixture.detectChanges();

    expect(el.textContent).toContain('Nothing downloaded yet');
    expect(el.querySelector('.profile__state a')?.getAttribute('href')).toBe('/all-recipes');
  });

  it('lists downloads as linked thumbnail rows and re-fetches after a delete', () => {
    const rows = [
      { _id: 'd1', recipeId: 'r1', name: 'Pad Thai', image: 'https://example.com/pad.jpg' },
      { _id: 'd2', recipeId: 'r2', name: 'Carbonara', image: 'https://example.com/carb.jpg' },
    ];
    http.expectOne(downloadsUrl).flush(rows);
    fixture.detectChanges();

    const items = el.querySelectorAll('.downloads__row');
    expect(items.length).toBe(2);
    expect(items[0].querySelector('a')?.getAttribute('href')).toBe('/view-recipe/r1');
    expect(items[0].querySelector('img')?.getAttribute('alt')).toBe('Photo of Pad Thai');

    const del = items[0].querySelector('button') as HTMLButtonElement;
    expect(del.getAttribute('aria-label')).toBe('Delete Pad Thai from your downloads');
    del.click();
    http.expectOne(`${environment.apiUrl}/api/deleteDownload/d1`).flush({});
    http.expectOne(downloadsUrl).flush([rows[1]]);
    fixture.detectChanges();

    expect(el.querySelectorAll('.downloads__row').length).toBe(1);
  });

  it('shows an alert when downloads cannot be loaded', () => {
    http.expectOne(downloadsUrl).flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(el.querySelector('.profile__alert')?.textContent).toContain('Could not load your downloads');
  });
});
