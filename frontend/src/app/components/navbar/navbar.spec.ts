import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { Navbar } from './navbar';
import { appTestProviders } from '../../../testing/providers';
import { fakeJwt } from '../../../testing/jwt';
import { AuthService } from '../../services/auth';

describe('Navbar', () => {
  let component: Navbar;
  let fixture: ComponentFixture<Navbar>;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent ?? '';
  const menuButton = () => el().querySelector('.site-header__toggle') as HTMLButtonElement;
  const signIn = (role = 'User', username = 'chef') => {
    TestBed.inject(AuthService).setSession(fakeJwt(), { username, email: 'c@b.co', role });
    fixture.detectChanges();
  };

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Navbar],
      providers: appTestProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(Navbar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => sessionStorage.clear());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('has a wordmark that links home and labelled primary navigation', () => {
    expect(el().querySelector('a.wordmark')!.getAttribute('aria-label')).toBe('Cook With Me — home');
    const nav = el().querySelector('nav[aria-label="Primary"]')!;
    const links = Array.from(nav.querySelectorAll('.site-nav__list a')).map((a) => a.textContent!.trim());
    expect(links).toEqual(['Home', 'Recipes', 'About', 'Contact']);
  });

  it('offers Log in / Join while signed out', () => {
    expect(text()).toContain('Log in');
    expect(text()).toContain('Join');
    expect(text()).not.toContain('Log out');
  });

  it('updates immediately after login — no page reload needed', () => {
    signIn();
    expect(text()).toContain('chef');
    expect(text()).toContain('Log out');
    expect(text()).not.toContain('Join');
  });

  it('only shows the Admin panel link to admins', () => {
    signIn('User');
    expect(text()).not.toContain('Admin panel');
    signIn('Admin', 'root');
    expect(text()).toContain('Admin panel');
  });

  describe('mobile menu (keyboard-accessible disclosure)', () => {
    it('is collapsed by default, announces its state, and toggles open/closed', () => {
      expect(menuButton().getAttribute('aria-expanded')).toBe('false');
      expect(menuButton().getAttribute('aria-controls')).toBe('site-nav');
      expect(el().querySelector('#site-nav')!.classList).not.toContain('is-open');

      menuButton().click();
      fixture.detectChanges();
      expect(menuButton().getAttribute('aria-expanded')).toBe('true');
      expect(el().querySelector('#site-nav')!.classList).toContain('is-open');
      expect(menuButton().textContent).toContain('Close');

      menuButton().click();
      fixture.detectChanges();
      expect(menuButton().getAttribute('aria-expanded')).toBe('false');
    });

    it('closes on Escape and returns focus to the toggle', () => {
      document.body.appendChild(el());
      menuButton().click();
      fixture.detectChanges();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();

      expect(menuButton().getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(menuButton());
      el().remove();
    });

    it('closes when the user navigates, so it never lingers over the next page', async () => {
      menuButton().click();
      fixture.detectChanges();
      await TestBed.inject(Router).navigateByUrl('/');
      fixture.detectChanges();
      expect(menuButton().getAttribute('aria-expanded')).toBe('false');
    });

    it('closes when clicking elsewhere on the page', () => {
      menuButton().click();
      fixture.detectChanges();
      document.body.click();
      fixture.detectChanges();
      expect(menuButton().getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('account menu', () => {
    it('toggles with aria-expanded and closes on Escape', () => {
      signIn();
      const toggle = el().querySelector('.account__toggle') as HTMLButtonElement;
      expect(toggle.getAttribute('aria-expanded')).toBe('false');

      toggle.click();
      fixture.detectChanges();
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(el().querySelector('#account-menu')!.classList).toContain('is-open');

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
    });

    it('logging out clears the session', () => {
      signIn();
      const logout = Array.from(el().querySelectorAll('.account__menu button')).find((b) => b.textContent!.includes('Log out')) as HTMLButtonElement;
      logout.click();
      fixture.detectChanges();
      expect(TestBed.inject(AuthService).isLoggedIn()).toBeFalse();
      expect(text()).toContain('Join');
    });
  });
});
