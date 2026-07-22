import type { AccessRequirement } from './accessGuards';

export type RouteAccessRequirement = 'public' | AccessRequirement;

/**
 * Declarative projection of the existing page-level gates. This map does not
 * replace server authorization and is intentionally not wired as a new router
 * wrapper, which preserves the current callback and guest-preview behavior.
 */
export const ROUTE_ACCESS_POLICIES = Object.freeze({
  '/my': 'public',
  '/admin': 'admin-session',
  '/form/love-reading': 'public',
  '/preview/love-reading': 'public',
  '/auth/kakao/callback': 'public',
  '/payment/portone/callback': 'public',
  '/form/:id': 'login',
  '/checkout': 'login',
  '/loading': 'payment-or-report-access',
  '/report/:id': 'payment-or-report-access'
} as const satisfies Readonly<Record<string, RouteAccessRequirement>>);

const normalizePathname = (pathname: string) => {
  const normalized = pathname.trim() || '/';
  return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized;
};

export function getRouteAccessRequirement(pathname: string): RouteAccessRequirement {
  const normalized = normalizePathname(pathname);

  if (
    normalized === '/my' ||
    normalized === '/form/love-reading' ||
    normalized === '/preview/love-reading' ||
    normalized === '/auth/kakao/callback' ||
    normalized === '/payment/portone/callback'
  ) {
    return 'public';
  }

  if (normalized === '/admin' || normalized.startsWith('/admin/')) {
    return 'admin-session';
  }

  if (normalized === '/checkout') {
    return 'login';
  }

  if (normalized === '/loading' || normalized.startsWith('/report/')) {
    return 'payment-or-report-access';
  }

  if (normalized.startsWith('/form/')) {
    return 'login';
  }

  return 'public';
}
