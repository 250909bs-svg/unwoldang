import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getProductById } from '../registry';

const appSource = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');

describe('match-couple dedicated flow contract', () => {
  it('keeps the fixed product identity, price, and canonical routes', () => {
    const product = getProductById('match-couple');
    expect(product.id).toBe('match-couple');
    expect(product.displayName).toBe('월연도령 사주궁합');
    expect(product.price).toBe(69_000);
    expect(product.routes).toMatchObject({
      detail: '/detail/match-couple',
      intake: '/form/match-couple',
      checkout: '/checkout',
      loading: '/loading',
      preview: '/preview/match-couple',
      report: '/report/match-couple'
    });
  });

  it('wires dedicated screens before the generic routes', () => {
    expect(appSource).toContain("import('./products/match-couple/Detail')");
    expect(appSource).toContain("import('./products/match-couple/Intake')");
    expect(appSource).toContain("import('./products/match-couple/Preview')");
    expect(appSource).toContain("import('./products/match-couple/ReportRoute')");
    expect(appSource.indexOf('path="/detail/match-couple"')).toBeLessThan(appSource.indexOf('path="/detail/:id"'));
    expect(appSource.indexOf('path="/form/match-couple"')).toBeLessThan(appSource.indexOf('path="/form/:id"'));
    expect(appSource).toContain('path="/preview/match-couple"');
    const genericPreviewIndex = appSource.indexOf('path="/preview/:id"');
    if (genericPreviewIndex >= 0) {
      expect(appSource.indexOf('path="/preview/match-couple"')).toBeLessThan(genericPreviewIndex);
    }
    expect(appSource).toContain("'/preview/match-couple'");
    expect(appSource).toContain('<MatchCoupleReportRoute />');
    expect(appSource.indexOf('path="/report/match-couple"')).toBeLessThan(appSource.indexOf('path="/report/:id"'));
    expect(appSource).toContain("const Report = lazy(() => import('./pages/Report'))");
  });

  it('does not reactivate match-destiny', () => {
    expect(getProductById('match-destiny').status).toBe('archived');
    expect(appSource).not.toContain('MatchDestinyDetail');
    expect(appSource).not.toContain('MatchDestinyIntake');
    expect(appSource).not.toContain('MatchDestinyReport');
  });
});
