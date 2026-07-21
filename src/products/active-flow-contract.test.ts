import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { activeProducts, getProductByRoute } from './registry';

const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

const expectedActiveFlows: Record<string, readonly string[]> = {
  'general-signature': [
    '/detail/general-saju',
    '/form/general-signature',
    '/checkout',
    '/loading',
    '/report/general-signature'
  ],
  'past-life-goblin': [
    '/detail/past-life-goblin',
    '/form/past-life-goblin',
    '/checkout',
    '/loading',
    '/report/past-life-goblin'
  ],
  'love-reading': [
    '/detail/love-reading',
    '/form/love-reading',
    '/checkout',
    '/loading',
    '/report/love-reading'
  ],
  'love-reunion': [
    '/detail/love-reunion',
    '/form/love-reunion',
    '/checkout',
    '/loading',
    '/report/love-reunion'
  ],
  'match-couple': [
    '/detail/match-couple',
    '/form/match-couple',
    '/checkout',
    '/loading',
    '/report/match-couple'
  ]
};

function sourceForRoute(path: string) {
  const start = appSource.indexOf(`path="${path}"`);
  expect(start).toBeGreaterThanOrEqual(0);

  const nextRoute = appSource.indexOf('<Route', start);
  return appSource.slice(start, nextRoute >= 0 ? nextRoute : undefined);
}

function expectRouteWiring(path: string, ...tokens: string[]) {
  const routeSource = sourceForRoute(path);
  tokens.forEach((token) => expect(routeSource).toContain(token));
}

describe('active product flow contract', () => {
  it('keeps canonical detail, intake, checkout, loading, and report routes for all five products', () => {
    expect(activeProducts.map((product) => product.id)).toEqual(Object.keys(expectedActiveFlows));

    activeProducts.forEach((product) => {
      expect([
        product.routes.detail,
        product.routes.intake,
        product.routes.checkout,
        product.routes.loading,
        product.routes.report
      ]).toEqual(expectedActiveFlows[product.id]);

      expect(getProductByRoute(product.routes.detail)?.id).toBe(product.id);
      expect(getProductByRoute(product.routes.intake)?.id).toBe(product.id);
      expect(getProductByRoute(product.routes.report)?.id).toBe(product.id);
    });
  });

  it('wires specialized and generic detail and intake routes through product boundaries', () => {
    expectRouteWiring(
      '/detail/general-saju',
      'ProductRouteBoundary productId="general-signature"',
      '<GeneralSajuLanding />'
    );
    expectRouteWiring(
      '/detail/past-life-goblin',
      'ProductRouteBoundary productId="past-life-goblin"',
      '<PastLifeEntry />'
    );
    expectRouteWiring(
      '/detail/love-reading',
      'ProductRouteBoundary productId="love-reading"',
      '<LoveReadingEntry />'
    );
    expectRouteWiring('/detail/:id', '<GenericProductDetail />');
    expectRouteWiring(
      '/form/love-reading',
      'ProductRouteBoundary productId="love-reading"',
      '<LoveReadingIntake />'
    );
    expectRouteWiring('/form/:id', '<ProductIntakeRouteBoundary>', '<Form />');
  });

  it('wires checkout, loading, and report through their shared policy boundaries', () => {
    expectRouteWiring('/checkout', '<ProductCheckoutRouteBoundary>', '<Checkout />');
    expectRouteWiring('/loading', '<ProductLoadingRouteBoundary>', '<Loading />');
    expectRouteWiring('/report/:id', '<HistoricalReportRouteBoundary>', '<Report />');
  });
});
