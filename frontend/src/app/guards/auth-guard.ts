import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

// NOTE: client-side guards only improve UX. The API enforces authentication and
// the Admin role on every privileged endpoint; never rely on these for security.

/** Signed-in users only; anonymous visitors are sent to /login. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.hasValidSession()
    ? true
    : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Admins only. Used with canMatch so the admin bundle is not even downloaded otherwise. */
export const adminGuard: CanMatchFn = (_route, segments) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.hasValidSession()) {
    const returnUrl = '/' + segments.map((s) => s.path).join('/');
    return router.createUrlTree(['/login'], { queryParams: { returnUrl } });
  }
  return auth.isAdmin() ? true : router.createUrlTree(['/']);
};
