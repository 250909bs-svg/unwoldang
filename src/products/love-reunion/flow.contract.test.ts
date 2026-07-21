import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
const intakeSource = readFileSync(new URL('./LoveReunionIntake.tsx', import.meta.url), 'utf8');
const detailSource = readFileSync(new URL('./LoveReunionDetail.tsx', import.meta.url), 'utf8');
const reportSource = readFileSync(new URL('../../pages/Report.tsx', import.meta.url), 'utf8');
const mySource = readFileSync(new URL('../../pages/My.tsx', import.meta.url), 'utf8');
const boundarySource = readFileSync(
  new URL('../components/ProductFlowRouteBoundaries.tsx', import.meta.url),
  'utf8'
);

function sourceForRoute(path: string) {
  const start = appSource.indexOf(`path="${path}"`);
  expect(start).toBeGreaterThanOrEqual(0);

  const nextRoute = appSource.indexOf('<Route', start);
  return appSource.slice(start, nextRoute >= 0 ? nextRoute : undefined);
}

describe('love-reunion product flow contract', () => {
  it('uses its owned detail and intake before the generic routes', () => {
    expect(appSource.indexOf('path="/detail/love-reunion"')).toBeLessThan(
      appSource.indexOf('path="/detail/:id"')
    );
    expect(appSource.indexOf('path="/form/love-reunion"')).toBeLessThan(
      appSource.indexOf('path="/form/:id"')
    );
    expect(sourceForRoute('/detail/love-reunion')).toContain(
      'ProductRouteBoundary productId="love-reunion"'
    );
    expect(sourceForRoute('/detail/love-reunion')).toContain('<LoveReunionDetail />');
    expect(sourceForRoute('/form/love-reunion')).toContain(
      'ProductIntakeRouteBoundary productId="love-reunion"'
    );
    expect(sourceForRoute('/form/love-reunion')).toContain('<LoveReunionIntake />');
    expect(detailSource).toContain('to={loveReunionProduct.routes.intake}');
  });

  it('keeps form entry open to guests and resumes checkout after login', () => {
    const submitStart = intakeSource.indexOf('const completeIntake');
    const loginNavigation = intakeSource.indexOf("navigate('/login'");

    expect(submitStart).toBeGreaterThanOrEqual(0);
    expect(loginNavigation).toBeGreaterThan(submitStart);
    expect(intakeSource).toContain('LOVE_REUNION_DRAFT_KEY');
    expect(intakeSource).toContain('LOVE_REUNION_CHECKOUT_INTENT_KEY');
    expect(intakeSource).toContain('navigate(loveReunionProduct.routes.checkout');
    expect(boundarySource).toContain('productId?: string');
    expect(intakeSource).toContain('CHECKOUT_INTENT_TTL_MS');
    expect(intakeSource).toContain('clearStoredDraft();');
    expect(intakeSource).not.toContain('상대방 이름 또는 호칭');
  });

  it('retains the shared checkout, loading, and historical report policy boundaries', () => {
    expect(sourceForRoute('/checkout')).toContain('<ProductCheckoutRouteBoundary>');
    expect(sourceForRoute('/loading')).toContain('<ProductLoadingRouteBoundary>');
    expect(sourceForRoute('/report/:id')).toContain('<HistoricalReportRouteBoundary>');
  });

  it('applies the owned report model to paid data and shares only the public detail', () => {
    expect(reportSource).toContain('buildLoveReunionReport(candidate');
    expect(reportSource).toContain('applyProductOwnedModel(reportData)');
    expect(reportSource).toMatch(
      /isLoveReunionShowcase\s*\?\s*createLoveReunionShareData\(window\.location\.origin\)/u
    );
    expect(reportSource).toContain("? 'premium-report-page love-reunion-premium-page'");
  });

  it('replays archived reports from My with the stored input and report artifact', () => {
    expect(mySource).toContain('orderId: report.orderId');
    expect(mySource).toContain('to={`/report/${report.productId}`}');
    expect(mySource).toContain('formData: report.formData');
    expect(mySource).toContain('reportData: report.reportData');
  });
});
