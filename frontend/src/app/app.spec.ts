import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { App } from './app';
import { appTestProviders } from '../testing/providers';

@Component({ template: '' })
class Blank {}

describe('App', () => {
  it('should create the app', async () => {
    await TestBed.configureTestingModule({ imports: [App], providers: appTestProviders }).compileComponents();
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the public navbar and footer around the router outlet', async () => {
    await TestBed.configureTestingModule({ imports: [App], providers: appTestProviders }).compileComponents();
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-navbar')).not.toBeNull();
    expect(el.querySelector('router-outlet')).not.toBeNull();
    expect(el.querySelector('app-footer')).not.toBeNull();
  });

  it('hides the public navbar and footer inside the admin area', async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: '', component: Blank },
          { path: 'admin', component: Blank },
        ]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    const el = fixture.nativeElement as HTMLElement;

    await router.navigateByUrl('/');
    fixture.detectChanges();
    expect(el.querySelector('app-navbar')).not.toBeNull();

    await router.navigateByUrl('/admin');
    fixture.detectChanges();
    expect(el.querySelector('app-navbar')).toBeNull();
    expect(el.querySelector('app-footer')).toBeNull();
  });
});
