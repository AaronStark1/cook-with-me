import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { AdminLayout } from './admin-layout';
import { appTestProviders } from '../../../testing/providers';
import { fakeJwt } from '../../../testing/jwt';
import { AuthService } from '../../services/auth';

describe('AdminLayout', () => {
  let component: AdminLayout;
  let fixture: ComponentFixture<AdminLayout>;
  const el = () => fixture.nativeElement as HTMLElement;
  const toggle = () => el().querySelector<HTMLButtonElement>('.admin__toggle')!;
  const nav = () => el().querySelector<HTMLElement>('#admin-nav')!;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AdminLayout],
      providers: appTestProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminLayout);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => sessionStorage.clear());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does not render its own <main> (the app shell provides it)', () => {
    expect(el().querySelector('main')).toBeNull();
  });

  it('shows the signed-in admin and the nav links', () => {
    TestBed.inject(AuthService).setSession(fakeJwt(), { username: 'root', email: 'r@b.co', role: 'Admin' });
    fixture.detectChanges();

    expect(nav().textContent).toContain('Signed in as root');
    expect(nav().textContent).toContain('Dashboard');
    expect(nav().textContent).toContain('Logout');
  });

  describe('mobile menu toggle', () => {
    it('starts closed and is wired to the nav panel', () => {
      expect(toggle().getAttribute('aria-expanded')).toBe('false');
      expect(toggle().getAttribute('aria-controls')).toBe('admin-nav');
      expect(toggle().textContent?.trim()).toBe('Menu');
      expect(nav().classList).not.toContain('is-open');
    });

    it('opens and closes on click, keeping aria-expanded and the label in sync', () => {
      toggle().click();
      fixture.detectChanges();
      expect(toggle().getAttribute('aria-expanded')).toBe('true');
      expect(toggle().textContent?.trim()).toBe('Close');
      expect(nav().classList).toContain('is-open');

      toggle().click();
      fixture.detectChanges();
      expect(toggle().getAttribute('aria-expanded')).toBe('false');
      expect(nav().classList).not.toContain('is-open');
    });

    it('Escape closes the menu and returns focus to the toggle', () => {
      toggle().click();
      fixture.detectChanges();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();

      expect(nav().classList).not.toContain('is-open');
      expect(toggle().getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(toggle());
    });

    it('closes after navigating to another admin page', async () => {
      toggle().click();
      fixture.detectChanges();

      await TestBed.inject(Router).navigateByUrl('/');
      fixture.detectChanges();

      expect(nav().classList).not.toContain('is-open');
    });
  });
});
