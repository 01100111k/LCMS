import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, Role } from './auth.service';

export const roleGuard = (role: Role): CanActivateFn => async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready;
  if (!auth.user() || !auth.role()) return router.createUrlTree(['/login']);
  if (auth.role() === role) return true;
  return router.createUrlTree([auth.homeRoute()]);
};

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready;
  return auth.user() && auth.role() ? router.createUrlTree([auth.homeRoute()]) : true;
};