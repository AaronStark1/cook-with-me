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
});
