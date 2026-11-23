import { ComponentFixture, TestBed } from '@angular/core/testing';

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
