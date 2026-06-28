import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { Auth } from '@angular/fire/auth';
import { from, switchMap } from 'rxjs';

/**
 * Attaches the signed-in user's Firebase ID token as a Bearer header to every
 * request to our own serverless API (/api/*). The backend verifies it so the
 * paid AI/Plaid/flight endpoints can't be called anonymously.
 *
 * Public endpoints (e.g. /api/public-itinerary, hit from the logged-out share
 * page) simply receive no header when there's no user — the server doesn't
 * require auth for those.
 */
export const apiAuthInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/')) return next(req);

  const auth = inject(Auth);
  const user = auth.currentUser;
  if (!user) return next(req);

  return from(user.getIdToken()).pipe(
    switchMap(token =>
      next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))
    ),
  );
};
