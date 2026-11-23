import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DownloadList } from './download-list';
import { appTestProviders } from '../../../testing/providers';

describe('DownloadList', () => {
  let component: DownloadList;
  let fixture: ComponentFixture<DownloadList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DownloadList],
      providers: appTestProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(DownloadList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
