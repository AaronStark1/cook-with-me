import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { Register } from './register';
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
});
