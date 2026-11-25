import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { Register, passwordScore } from './register';
import { appTestProviders } from '../../../testing/providers';
import { environment } from '../../../environments/environment';

describe('Register', () => {
  let component: Register;
  let fixture: ComponentFixture<Register>;
  let http: HttpTestingController;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Register],
      providers: appTestProviders
    })
    .compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Register);
    component = fixture.componentInstance;
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  afterEach(() => http.verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('keeps the field ids, labels and a single h1', () => {
    expect(el.querySelectorAll('h1').length).toBe(1);
    for (const id of ['username', 'email', 'password']) {
      expect(el.querySelector(`#${id}`)).not.toBeNull();
      expect(el.querySelector(`label[for="${id}"]`)).not.toBeNull();
    }
    expect(el.querySelector('form')?.hasAttribute('novalidate')).toBeTrue();
  });

  it('shows inline errors and does not call the API when the form is invalid', () => {
    component.registerForm.setValue({ username: 'a', email: 'a@b.co', password: 'short' });
    component.submit();
    fixture.detectChanges();

    http.expectNone(`${environment.apiUrl}/api/registration`);
    expect(el.querySelectorAll('.is-invalid').length).toBe(1);
    expect(el.textContent).toContain('between 8 and 72');
  });

  it('shows the server message when registration fails', () => {
    component.registerForm.setValue({ username: 'a', email: 'a@b.co', password: 'long-enough-1' });
    component.submit();
    http.expectOne(`${environment.apiUrl}/api/registration`)
      .flush({ message: 'Email is already registered' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(el.querySelector('.alert-danger')?.textContent).toContain('Email is already registered');
  });

  it('lists the three account perks with decorative numerals hidden from assistive tech', () => {
    expect(el.querySelectorAll('.perks li').length).toBe(3);
    el.querySelectorAll('.perks__n').forEach((n) => expect(n.getAttribute('aria-hidden')).toBe('true'));
  });

  it('uses no external background image', () => {
    expect(el.querySelectorAll('img').length).toBe(0);
  });

  describe('motion layer', () => {
    it('toggles the password between hidden and shown', () => {
      const input = el.querySelector('#password') as HTMLInputElement;
      const toggle = el.querySelector('.auth__eye') as HTMLButtonElement;

      expect(input.type).toBe('password');
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
      expect(toggle.getAttribute('aria-label')).toBe('Show password');

      toggle.click();
      fixture.detectChanges();

      expect(input.type).toBe('text');
      expect(toggle.getAttribute('aria-pressed')).toBe('true');
      expect(toggle.getAttribute('aria-label')).toBe('Hide password');
      expect(input.getAttribute('autocomplete')).toBe('new-password');
      http.expectNone(`${environment.apiUrl}/api/registration`);
    });

    it('scores a password from what was typed only', () => {
      expect(passwordScore('')).toBe(0);
      expect(passwordScore(null)).toBe(0);
      expect(passwordScore('short')).toBe(1);
      expect(passwordScore('longenough')).toBe(2);
      expect(passwordScore('Longenough1')).toBe(3);
      expect(passwordScore('averyveryverylongone')).toBe(3);
      expect(passwordScore('Long-enough-123')).toBe(4);
    });

    it('lights the decorative meter as the password grows, without changing what is valid', () => {
      const meter = el.querySelector('.meter') as HTMLElement;
      const lit = () => meter.querySelectorAll('.is-on').length;
      expect(meter.getAttribute('aria-hidden')).toBe('true');
      expect(meter.children.length).toBe(4);
      expect(lit()).toBe(0);

      component.registerForm.patchValue({ password: 'longenough' });
      fixture.detectChanges();
      expect(lit()).toBe(2);
      // a low score is still a valid password: only the validators decide
      expect(component.f['password'].valid).toBeTrue();

      component.registerForm.patchValue({ password: 'Long-enough-123' });
      fixture.detectChanges();
      expect(lit()).toBe(4);
    });

    it('shows the plate loader in the submit button while registering', () => {
      const button = el.querySelector('button[type=submit]') as HTMLButtonElement;
      const visible = () => [...button.querySelectorAll<HTMLElement>('.auth__go')]
        .filter((label) => getComputedStyle(label).visibility === 'visible')
        .map((label) => label.textContent?.trim());
      expect(visible()).toEqual(['Register']);

      component.registerForm.setValue({ username: 'a', email: 'a@b.co', password: 'long-enough-1' });
      component.submit();
      fixture.detectChanges();

      expect(visible()).toEqual(['Registering…']);
      expect(button.querySelector('.loader')?.getAttribute('aria-hidden')).toBe('true');
      http.expectOne(`${environment.apiUrl}/api/registration`)
        .flush({ message: 'Email is already registered' }, { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();
      expect(visible()).toEqual(['Register']);
    });
  });
});
