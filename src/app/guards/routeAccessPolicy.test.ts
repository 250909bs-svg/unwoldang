import { describe, expect, it } from 'vitest';
import { getRouteAccessRequirement, ROUTE_ACCESS_POLICIES } from './routeAccessPolicy';

describe('route access policy', () => {
  it('documents every existing protected route family', () => {
    expect(ROUTE_ACCESS_POLICIES).toMatchObject({
      '/form/:id': 'login',
      '/checkout': 'login',
      '/loading': 'payment-or-report-access',
      '/report/:id': 'payment-or-report-access',
      '/admin': 'admin-session'
    });
  });

  it.each([
    ['/my', 'public'],
    ['/form/love-reading', 'public'],
    ['/preview/love-reading', 'public'],
    ['/auth/kakao/callback', 'public'],
    ['/payment/portone/callback', 'public'],
    ['/form/general-signature', 'login'],
    ['/checkout', 'login'],
    ['/loading', 'payment-or-report-access'],
    ['/report/love-reading', 'payment-or-report-access'],
    ['/admin', 'admin-session'],
    ['/admin/reports', 'admin-session']
  ] as const)('maps %s to %s', (pathname, requirement) => {
    expect(getRouteAccessRequirement(pathname)).toBe(requirement);
  });
});
