import { TestBed } from '@angular/core/testing';
import { Route, Router, UrlSegment, UrlTree, provideRouter } from '@angular/router';
import { fakeJwt } from '../../testing/jwt';
import { AuthService } from '../services/auth';
import { adminGuard, authGuard } from './auth-guard';

describe('route guards', () => {
  let auth: AuthService;
  let router: Router;

  const runAuthGuard = (url: string) =>
    TestBed.runInInjectionContext(() => authGuard({} as any, { url } as any));
  const runAdminGuard = (...paths: string[]) =>
    TestBed.runInInjectionContext(() => adminGuard({} as Route, paths.map((p) => new UrlSegment(p, {}))));
  const asUrl = (result: unknown) => router.serializeUrl(result as UrlTree);

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  afterEach(() => sessionStorage.clear());

  describe('authGuard', () => {
    it('sends anonymous visitors to /login and remembers where they were going', () => {
      expect(asUrl(runAuthGuard('/profile'))).toBe('/login?returnUrl=%2Fprofile');
    });

    it('lets signed-in users through', () => {
      auth.setSession(fakeJwt(), { username: 'a', email: 'a@b.co', role: 'User' });
      expect(runAuthGuard('/profile')).toBeTrue();
    });

    it('treats an expired token as signed out', () => {
      auth.setSession(fakeJwt(-5), { username: 'a', email: 'a@b.co', role: 'User' });
      expect(asUrl(runAuthGuard('/saved-recipes'))).toBe('/login?returnUrl=%2Fsaved-recipes');
    });
  });

  describe('adminGuard', () => {
    it('sends anonymous visitors to /login', () => {
      expect(asUrl(runAdminGuard('admin'))).toBe('/login?returnUrl=%2Fadmin');
    });

    it('sends signed-in non-admins home', () => {
      auth.setSession(fakeJwt(), { username: 'a', email: 'a@b.co', role: 'User' });
      expect(asUrl(runAdminGuard('admin'))).toBe('/');
    });

    it('lets admins through', () => {
      auth.setSession(fakeJwt(), { username: 'root', email: 'r@b.co', role: 'Admin' });
      expect(runAdminGuard('admin')).toBeTrue();
    });
  });
});
