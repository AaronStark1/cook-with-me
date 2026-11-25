import { TestBed } from '@angular/core/testing';
import { fakeJwt } from '../../testing/jwt';
import { AuthService } from './auth';

describe('AuthService', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({});
  });

  afterEach(() => sessionStorage.clear());

  it('starts logged out', () => {
    const auth = TestBed.inject(AuthService);
    expect(auth.isLoggedIn()).toBeFalse();
    expect(auth.user()).toBeNull();
    expect(auth.hasValidSession()).toBeFalse();
  });

  it('persists only { _id, username, email, role } — never a password hash', () => {
    const auth = TestBed.inject(AuthService);
    auth.setSession(fakeJwt(), {
      _id: '1', username: 'chef', email: 'chef@example.com', role: 'User',
      password: '$2b$10$secret-hash', extra: 'nope',
    } as any);

    const stored = sessionStorage.getItem('userDetails')!;
    expect(Object.keys(JSON.parse(stored)).sort()).toEqual(['_id', 'email', 'role', 'username']);
    expect(stored).not.toContain('secret-hash');
    expect(auth.isLoggedIn()).toBeTrue();
    expect(auth.user()?.username).toBe('chef');
  });

  it('treats any casing of "admin" as admin', () => {
    const auth = TestBed.inject(AuthService);
    auth.setSession(fakeJwt(), { username: 'a', email: 'a@b.co', role: 'admin' });
    expect(auth.isAdmin()).toBeTrue();
    auth.setSession(fakeJwt(), { username: 'a', email: 'a@b.co', role: 'User' });
    expect(auth.isAdmin()).toBeFalse();
  });

  it('clear() removes only the auth keys', () => {
    const auth = TestBed.inject(AuthService);
    sessionStorage.setItem('unrelated', 'keep-me');
    auth.setSession(fakeJwt(), { username: 'a', email: 'a@b.co', role: 'User' });

    auth.clear();

    expect(auth.isLoggedIn()).toBeFalse();
    expect(sessionStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('userDetails')).toBeNull();
    expect(sessionStorage.getItem('unrelated')).toBe('keep-me');
  });

  it('updateUser() keeps the role and token', () => {
    const auth = TestBed.inject(AuthService);
    const token = fakeJwt();
    auth.setSession(token, { username: 'old', email: 'old@b.co', role: 'User' });
    auth.updateUser({ username: 'new', email: 'new@b.co', role: 'Admin' });
    expect(auth.user()).toEqual(jasmine.objectContaining({ username: 'new', email: 'new@b.co', role: 'User' }));
    expect(auth.token()).toBe(token);
  });

  it('discards an expired token found in storage', () => {
    sessionStorage.setItem('token', fakeJwt(-60));
    sessionStorage.setItem('userDetails', JSON.stringify({ username: 'a', email: 'a@b.co', role: 'User' }));

    const auth = TestBed.inject(AuthService);

    expect(auth.isLoggedIn()).toBeFalse();
    expect(sessionStorage.getItem('token')).toBeNull();
  });

  it('drops a token that is not a JWT', () => {
    sessionStorage.setItem('token', 'garbage');
    expect(TestBed.inject(AuthService).isLoggedIn()).toBeFalse();
  });

  it('survives corrupt userDetails instead of throwing', () => {
    sessionStorage.setItem('token', fakeJwt());
    sessionStorage.setItem('userDetails', '{not json');

    const auth = TestBed.inject(AuthService);

    expect(auth.user()).toBeNull();
    expect(sessionStorage.getItem('userDetails')).toBeNull();
  });

  it('hasValidSession() clears the session once the token has expired', () => {
    const auth = TestBed.inject(AuthService);
    auth.setSession(fakeJwt(-1), { username: 'a', email: 'a@b.co', role: 'User' });

    expect(auth.hasValidSession()).toBeFalse();
    expect(auth.isLoggedIn()).toBeFalse();
  });
});
