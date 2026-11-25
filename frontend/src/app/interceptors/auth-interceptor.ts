import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth';

/**
 * - Attaches the bearer token to API requests (and only to API requests).
 * - On a 401 for an authenticated request the session is stale: clear the auth
 *   keys and send the user to /login instead of silently showing empty lists.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isApi = req.url.startsWith(`${environment.apiUrl}/api/`);
  const token = auth.token();
  const outgoing = isApi && token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(outgoing).pipe(
    catchError((err: HttpErrorResponse) => {
      const isLoginCall = req.url.endsWith('/api/login');
      if (err.status === 401 && isApi && token && !isLoginCall) {
        const returnUrl = router.url;
        auth.clear();
        if (!returnUrl.startsWith('/login')) {
          router.navigate(['/login'], { queryParams: { returnUrl } });
        }
      }
      return throwError(() => err);
    }),
  );
};
