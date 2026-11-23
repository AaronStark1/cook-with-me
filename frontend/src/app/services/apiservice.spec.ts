import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { Apiservice } from './apiservice';

describe('Apiservice', () => {
  let service: Apiservice;
  let http: HttpTestingController;
  const api = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(Apiservice);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('registers through /api/registration (not /registration)', () => {
    service.registerUserAPI({ username: 'a' }).subscribe();
    const req = http.expectOne(`${api}/api/registration`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('loads recipes from /api/allRecipes', () => {
    service.getRecipeAPI().subscribe();
    http.expectOne(`${api}/api/allRecipes`).flush({ response: [] });
  });

  it('URL-encodes the cuisine for related recipes', () => {
    service.getRelatedRecipeAPI('Tex & Mex').subscribe();
    const req = http.expectOne((r) => r.url === `${api}/api/relatedRecipe`);
    expect(req.request.params.get('cuisine')).toBe('Tex & Mex');
    expect(req.request.urlWithParams).toContain('cuisine=Tex%20%26%20Mex');
    req.flush([]);
  });

  it('saves a recipe with POST /api/savedRecipe/:id', () => {
    service.saveRecipeAPI('abc').subscribe();
    const req = http.expectOne(`${api}/api/savedRecipe/abc`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('updates the profile with PATCH /api/updateProfile', () => {
    service.updateProfileAPI({ username: 'a', email: 'a@b.co' }).subscribe();
    const req = http.expectOne(`${api}/api/updateProfile`);
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('does not attach auth headers itself (the interceptor does that)', () => {
    sessionStorage.setItem('token', 'should-not-be-read-here');
    service.getSavedRecipesAPI().subscribe();
    const req = http.expectOne(`${api}/api/getSavedRecipes`);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush([]);
    sessionStorage.clear();
  });
});
