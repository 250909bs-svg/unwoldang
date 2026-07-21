import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getRouteAccessRequirement } from './routeAccessPolicy';

const appSource = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
const appRoutePaths = Array.from(
  appSource.matchAll(/<Route\s+path="([^"]+)"/g),
  (match) => match[1]
);

describe('App route and access-policy integration contract', () => {
  it('keeps every declared protected route family present in App.tsx', () => {
    expect(appRoutePaths).toEqual(expect.arrayContaining([
      '/admin',
      '/form/:id',
      '/checkout',
      '/loading',
      '/report/:id'
    ]));
  });

  it('keeps guest and callback exceptions present and public', () => {
    const publicExceptions = [
      '/my',
      '/form/love-reading',
      '/preview/love-reading',
      '/auth/kakao/callback',
      '/payment/portone/callback'
    ];

    expect(appRoutePaths).toEqual(expect.arrayContaining(publicExceptions));
    for (const path of publicExceptions) {
      expect(getRouteAccessRequirement(path)).toBe('public');
    }
  });

  it('projects each concrete protected path to its documented requirement', () => {
    expect(getRouteAccessRequirement('/admin')).toBe('admin-session');
    expect(getRouteAccessRequirement('/form/general-signature')).toBe('login');
    expect(getRouteAccessRequirement('/checkout')).toBe('login');
    expect(getRouteAccessRequirement('/loading')).toBe('payment-or-report-access');
    expect(getRouteAccessRequirement('/report/general-signature')).toBe(
      'payment-or-report-access'
    );
  });

  it('keeps the main product lifecycle boundaries composed outside flow pages', () => {
    expect(appSource).toContain('<ProductIntakeRouteBoundary>');
    expect(appSource).toContain('<ProductCheckoutRouteBoundary>');
    expect(appSource).toContain('<ProductLoadingRouteBoundary>');
    expect(appSource).toContain('<HistoricalReportRouteBoundary>');
  });
});
