import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { Login } from './login';
import { appTestProviders } from '../../../testing/providers';
import { fakeJwt } from '../../../testing/jwt';
import { environment } from '../../../environments/environment';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let http: HttpTestingController;
  let navigateByUrl: jasmine.Spy;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: appTestProviders
    })
    .compileComponents();

    http = TestBed.inject(HttpTestingController);
    navigateByUrl = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  const submit = (email = 'chef@example.com', password = 'correct-horse') => {
    component.loginForm.setValue({ email, password });
    component.login();
  };

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does not call the API while the form is invalid, and shows inline errors', () => {
    component.login();
    fixture.detectChanges();

    http.expectNone(`${environment.apiUrl}/api/login`);
    expect(fixture.nativeElement.querySelectorAll('.is-invalid').length).toBe(2);
  });

  it('stores only safe user fields and goes home after login', () => {
    submit();
    http.expectOne(`${environment.apiUrl}/api/login`).flush({
      token: fakeJwt(),
      user: { _id: '1', username: 'chef', email: 'chef@example.com', role: 'User', password: 'LEAKED-HASH' }
    });

    const stored = sessionStorage.getItem('userDetails')!;
    expect(stored).not.toContain('LEAKED-HASH');
    expect(JSON.parse(stored).username).toBe('chef');
    expect(navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('sends admins to /admin (role casing from legacy data is tolerated)', () => {
    submit('root@example.com', 'pw');
    http.expectOne(`${environment.apiUrl}/api/login`).flush({
      token: fakeJwt(),
      user: { _id: '2', username: 'root', email: 'root@example.com', role: 'admin' }
    });

    expect(navigateByUrl).toHaveBeenCalledWith('/admin');
  });

  it('shows the server message when the credentials are wrong', () => {
    submit();
    http.expectOne(`${environment.apiUrl}/api/login`)
      .flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();

    expect(component.errorMessage).toBe('Invalid credentials');
    expect(fixture.nativeElement.textContent).toContain('Invalid credentials');
    expect(sessionStorage.getItem('token')).toBeNull();
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  describe('motion layer', () => {
    const el = () => fixture.nativeElement as HTMLElement;
    const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    it('toggles the password between hidden and shown without touching the form', () => {
      const input = el().querySelector('#password') as HTMLInputElement;
      const toggle = el().querySelector('.auth__eye') as HTMLButtonElement;
      component.loginForm.patchValue({ password: 'correct-horse' });

      expect(input.type).toBe('password');
      expect(toggle.type).toBe('button');
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
      expect(toggle.getAttribute('aria-label')).toBe('Show password');

      toggle.click();
      fixture.detectChanges();
      expect(input.type).toBe('text');
      expect(toggle.getAttribute('aria-pressed')).toBe('true');
      expect(toggle.getAttribute('aria-label')).toBe('Hide password');

      toggle.click();
      fixture.detectChanges();
      expect(input.type).toBe('password');
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
      expect(component.loginForm.value.password).toBe('correct-horse');
      expect(component.submitted).toBeFalse();
    });

    it('keeps each message next to its field, hidden until that field is flagged', () => {
      const messages = [...el().querySelectorAll<HTMLElement>('.auth__field .invalid-feedback')];
      expect(messages.length).toBe(2);
      messages.forEach((m) => expect(getComputedStyle(m).visibility).toBe('hidden'));

      component.login();
      fixture.detectChanges();

      messages.forEach((m) => {
        expect(m.matches('.is-invalid ~ .invalid-feedback')).toBeTrue();
        expect(getComputedStyle(m).visibility).toBe('visible');
      });
      expect(messages[0].textContent).toContain('Email is required.');
      expect(messages[1].textContent).toContain('Password is required.');
    });

    it('shows the plate loader in the submit button while signing in, and only then', () => {
      const button = el().querySelector('button[type=submit]') as HTMLButtonElement;
      const visible = () => [...button.querySelectorAll<HTMLElement>('.auth__go')]
        .filter((label) => getComputedStyle(label).visibility === 'visible')
        .map((label) => label.textContent?.trim());
      const loader = button.querySelector('.loader') as HTMLElement;

      expect(visible()).toEqual(['Sign In']);
      expect(loader.getAttribute('aria-hidden')).toBe('true');
      expect(loader.classList).toContain('loader--still');

      submit();
      fixture.detectChanges();
      expect(visible()).toEqual(['Signing in…']);
      expect(button.disabled).toBeTrue();
      expect(loader.classList).not.toContain('loader--still');

      http.expectOne(`${environment.apiUrl}/api/login`)
        .flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });
      fixture.detectChanges();
      expect(visible()).toEqual(['Sign In']);
      expect(button.disabled).toBeFalse();
    });

    it('shakes the fields an invalid submit leaves flagged (and the toggle beside the password)', async () => {
      const animate = spyOn(HTMLElement.prototype, 'animate').and.callThrough();

      (el().querySelector('button[type=submit]') as HTMLButtonElement).click();
      fixture.detectChanges();
      await nextFrame();

      const shaken = animate.calls.all().map((call) => call.object as HTMLElement);
      expect(shaken.map((node) => node.id || node.className)).toEqual(['email', 'password', 'auth__eye']);
      expect(animate.calls.first().args[1]).toEqual(jasmine.objectContaining({ duration: 240 }));
      http.expectNone(`${environment.apiUrl}/api/login`);
    });

    it('does not shake when the submit is valid', async () => {
      const animate = spyOn(HTMLElement.prototype, 'animate').and.callThrough();
      component.loginForm.setValue({ email: 'chef@example.com', password: 'correct-horse' });

      (el().querySelector('button[type=submit]') as HTMLButtonElement).click();
      fixture.detectChanges();
      await nextFrame();

      expect(animate).not.toHaveBeenCalled();
      http.expectOne(`${environment.apiUrl}/api/login`).flush({}, { status: 401, statusText: 'Unauthorized' });
    });
  });
});

describe('Login under reduced motion', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: appTestProviders
    })
    .compileComponents();
  });

  afterEach(() => sessionStorage.clear());

  it('keeps every message and control, and shakes nothing', async () => {
    // before anything asks MotionPrefs, so the whole page is created "reduced"
    spyOn(window, 'matchMedia').and.returnValue({ matches: true, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList);
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const animate = spyOn(HTMLElement.prototype, 'animate').and.callThrough();

    (host.querySelector('button[type=submit]') as HTMLButtonElement).click();
    fixture.detectChanges();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    expect(animate).not.toHaveBeenCalled();
    expect(host.querySelectorAll('.is-invalid').length).toBe(2);
    expect(host.textContent).toContain('Password is required.');
    expect(host.querySelector('.auth__eye')).not.toBeNull();
    expect(host.querySelector('button[type=submit] .loader')).not.toBeNull();
    TestBed.inject(HttpTestingController).verify();
  });
});
