import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

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

@Component({ template: '' })
class BlankPage {}

describe('AdminLayout — sidebar indicator bar', () => {
  let fixture: ComponentFixture<AdminLayout>;
  const el = () => fixture.nativeElement as HTMLElement;
  const list = () => el().querySelector<HTMLElement>('#admin-nav ul')!;
  const active = () => list().querySelector<HTMLElement>('a[aria-current="page"]');
  const frames = async (count: number) => {
    for (let i = 0; i < count; i++) await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  };

  /** Lands on /admin/userslist with the nav open, so it can be measured at any viewport width. */
  async function open(reducedMotion = false) {
    if (reducedMotion) {
      spyOn(window, 'matchMedia').and.returnValue({ matches: true, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList);
    }
    fixture = TestBed.createComponent(AdminLayout);
    fixture.detectChanges();
    await TestBed.inject(Router).navigateByUrl('/admin/userslist');
    fixture.componentInstance.toggleNav();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.placeBar();
  }

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AdminLayout],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'admin/userslist', component: BlankPage },
          { path: 'admin/recipe/add', component: BlankPage },
        ]),
      ],
    }).compileComponents();
  });

  afterEach(() => sessionStorage.clear());

  it('measures the active link into one bar and keeps the active markers', async () => {
    await open();

    const link = active()!;
    expect(link.textContent).toContain('Users');
    expect(link.classList).toContain('is-active');
    expect(list().querySelectorAll('a[aria-current="page"]').length).toBe(1);

    expect(list().classList).toContain('has-bar');
    expect(Number(list().style.getPropertyValue('--bar-h'))).toBeCloseTo(link.getBoundingClientRect().height, 1);
    expect(parseFloat(list().style.getPropertyValue('--bar-y')))
      .toBeCloseTo(link.getBoundingClientRect().top - list().getBoundingClientRect().top, 1);
  });

  it('places the bar without animation first and only then enables the glide', async () => {
    await open();
    await frames(4);
    expect(list().classList).toContain('is-ready');
  });

  it('closes the bar when no sidebar link is active', async () => {
    await open();
    await TestBed.inject(Router).navigateByUrl('/admin/recipe/add');
    fixture.componentInstance.toggleNav();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.placeBar();

    expect(active()).toBeNull();
    expect(list().style.getPropertyValue('--bar-h')).toBe('0');
  });

  it('falls back to the per-link style while the list cannot be measured', async () => {
    await open();
    el().querySelector<HTMLElement>('#admin-nav')!.style.display = 'none';
    fixture.componentInstance.placeBar();

    expect(list().classList).not.toContain('has-bar');
    expect(list().classList).not.toContain('is-ready');
    expect(active()!.classList).toContain('is-active');
  });

  it('never enables the glide under reduced motion', async () => {
    await open(true);
    await frames(4);

    expect(list().classList).toContain('has-bar');
    expect(list().classList).not.toContain('is-ready');
  });
});
