import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { fakeJwt } from '../../testing/jwt';
import { AuthService } from '../services/auth';
import { authInterceptor } from './auth-interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let auth: AuthService;
  let navigate: jasmine.Spy;
  const api = environment.apiUrl;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
  });

  afterEach(() => {
    controller.verify();
    sessionStorage.clear();
  });

  const signIn = () => auth.setSession(fakeJwt(), { username: 'a', email: 'a@b.co', role: 'User' });

  it('attaches the bearer token to API requests', () => {
    signIn();
    http.get(`${api}/api/getSavedRecipes`).subscribe();
    const req = controller.expectOne(`${api}/api/getSavedRecipes`);
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${auth.token()}`);
    req.flush([]);
  });

  it('sends no Authorization header when signed out', () => {
    http.get(`${api}/api/allRecipes`).subscribe();
    const req = controller.expectOne(`${api}/api/allRecipes`);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('never leaks the token to non-API URLs', () => {
    signIn();
    http.get('https://third-party.example/data.json').subscribe();
    const req = controller.expectOne('https://third-party.example/data.json');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('clears the session and redirects to /login on a 401', () => {
    signIn();
    http.get(`${api}/api/getSavedRecipes`).subscribe({ error: () => {} });
    controller.expectOne(`${api}/api/getSavedRecipes`).flush({ message: 'expired' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.isLoggedIn()).toBeFalse();
    expect(sessionStorage.getItem('token')).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login'], jasmine.objectContaining({ queryParams: jasmine.anything() }));
  });

  it('still surfaces the error to the caller', () => {
    signIn();
    let status = 0;
    http.get(`${api}/api/getSavedRecipes`).subscribe({ error: (e) => (status = e.status) });
    controller.expectOne(`${api}/api/getSavedRecipes`).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(status).toBe(401);
  });

  it('does not redirect when a login attempt itself fails with 401', () => {
    signIn();
    http.post(`${api}/api/login`, {}).subscribe({ error: () => {} });
    controller.expectOne(`${api}/api/login`).flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not redirect on a 401 for an anonymous request', () => {
    http.get(`${api}/api/getSavedRecipes`).subscribe({ error: () => {} });
    controller.expectOne(`${api}/api/getSavedRecipes`).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(navigate).not.toHaveBeenCalled();
  });
});
