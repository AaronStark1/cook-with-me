import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

/**
 * Providers most components need in a unit test: HttpClient (backed by the
 * testing controller, so no real network calls) and an empty router.
 */
export const appTestProviders = [
  provideHttpClient(),
  provideHttpClientTesting(),
  provideRouter([]),
];
