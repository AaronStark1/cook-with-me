import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { RequestList } from './request-list';
import { appTestProviders } from '../../../testing/providers';

describe('RequestList', () => {
  let component: RequestList;
  let fixture: ComponentFixture<RequestList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RequestList],
      providers: appTestProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(RequestList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('RequestList — moderating a request', () => {
  let fixture: ComponentFixture<RequestList>;
  let http: HttpTestingController;

  const list = (statusOfB = 'Pending') => ({
    allTestimony: [
      { _id: 'a', username: 'Asha', email: 'a@b.co', message: 'Lovely', status: 'Approved' },
      { _id: 'b', username: 'Ben', email: 'b@b.co', message: 'Tasty', status: statusOfB },
    ],
  });
  const el = () => fixture.nativeElement as HTMLElement;
  const rows = () => Array.from(el().querySelectorAll<HTMLTableRowElement>('tbody tr'));
  const tag = (row: number) => rows()[row].querySelector<HTMLElement>('.tag')!;
  const expectList = () => http.expectOne((req) => req.method === 'GET' && req.url.includes('/api/getTestimony'));
  const expectUpdate = () => http.expectOne((req) => req.method === 'PATCH' && req.url.endsWith('/api/updateTestimony/b'));

  function load(reducedMotion = false) {
    if (reducedMotion) {
      spyOn(window, 'matchMedia').and.returnValue({ matches: true, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList);
    }
    fixture = TestBed.createComponent(RequestList);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    expectList().flush(list());
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RequestList], providers: appTestProviders }).compileComponents();
  });

  it('changes nothing until the API succeeds, then keeps the row and marks only its new tag', () => {
    load();
    expect(el().querySelector('.is-fresh')).toBeNull(); // tags present on load never animate

    el().querySelector<HTMLButtonElement>('button[aria-label="Approve"]')!.click();
    fixture.detectChanges();
    expect(tag(1).textContent).toContain('Pending');
    expect(el().querySelector('.is-fresh')).toBeNull();

    const update = expectUpdate();
    expect(update.request.body).toEqual({ status: 'Approved' });
    update.flush({});
    fixture.detectChanges();
    expect(tag(1).textContent).toContain('Pending'); // still the server's last word

    expectList().flush(list('Approved'));
    fixture.detectChanges();

    expect(rows().length).toBe(2); // moderated requests stay listed
    expect(tag(1).textContent).toContain('Approved');
    expect(tag(1).classList).toContain('is-fresh');
    expect(tag(0).classList).not.toContain('is-fresh');
    expect(rows()[1].querySelector('.row-actions')).toBeNull();
    http.verify();
  });

  it('marks nothing under reduced motion', () => {
    load(true);
    expect(el().querySelector('tbody')!.classList).not.toContain('rows-in');

    el().querySelector<HTMLButtonElement>('button[aria-label="Reject"]')!.click();
    expectUpdate().flush({});
    expectList().flush(list('Rejected'));
    fixture.detectChanges();

    expect(tag(1).textContent).toContain('Rejected');
    expect(el().querySelector('.is-fresh')).toBeNull();
    http.verify();
  });

  it('shows the error and leaves the row as it was when the API fails', () => {
    load();

    el().querySelector<HTMLButtonElement>('button[aria-label="Approve"]')!.click();
    expectUpdate().flush({ message: 'Not allowed' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    expect(el().querySelector('.alert-danger')?.textContent).toContain('Not allowed');
    expect(tag(1).textContent).toContain('Pending');
    expect(el().querySelector('.is-fresh')).toBeNull();
    http.expectNone((req) => req.url.includes('/api/getTestimony'));
  });
});
