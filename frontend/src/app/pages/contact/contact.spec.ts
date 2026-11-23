import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { Contact } from './contact';
import { appTestProviders } from '../../../testing/providers';
import { fakeJwt } from '../../../testing/jwt';
import { AuthService } from '../../services/auth';
import { environment } from '../../../environments/environment';

describe('Contact', () => {
  let component: Contact;
  let fixture: ComponentFixture<Contact>;
  let el: HTMLElement;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Contact],
      providers: appTestProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(Contact);
    component = fixture.componentInstance;
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  afterEach(() => sessionStorage.clear());

  const signIn = () => {
    TestBed.inject(AuthService).setSession(fakeJwt(), { username: 'chef', email: 'chef@example.com', role: 'User' });
    fixture.detectChanges();
  };

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('keeps the existing contact details and a single h1', () => {
    expect(el.querySelectorAll('h1').length).toBe(1);
    expect(el.textContent).toContain('NYC 4567, PO Berlin.');
    expect(el.querySelector('a[href="mailto:cookwithme@gmail.com"]')).not.toBeNull();
    expect(el.querySelector('a[href="tel:989898989"]')).not.toBeNull();
  });

  it('shows signed-out visitors a branded login prompt instead of the form', () => {
    expect(el.querySelector('#message')).toBeNull();
    expect(el.textContent).toContain('Log in to share your testimony');
    const login = el.querySelector('.contact__state a') as HTMLAnchorElement;
    expect(login.textContent).toContain('Log in to continue');
    expect(login.getAttribute('href')).toContain('/login');
    expect(login.getAttribute('href')).toContain('returnUrl=%2Fcontact');
  });

  it('shows signed-in users the form and who they are posting as', () => {
    signIn();
    expect(el.querySelector('#message')).not.toBeNull();
    expect(el.querySelector('#profession')).not.toBeNull();
    expect(el.querySelector('#agree')).not.toBeNull();
    expect(el.textContent).toContain('Posting as');
    expect(el.textContent).toContain('chef');
  });

  it('flags message, profession and the terms checkbox on an empty submit, without calling the API', async () => {
    signIn();
    await fixture.whenStable(); // template-driven NgModel controls register asynchronously
    const http = TestBed.inject(HttpTestingController);

    (el.querySelector('button[type=submit]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelectorAll('.is-invalid').length).toBe(3);
    http.expectNone(`${environment.apiUrl}/api/addTestimony`);
  });
});
