import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pastLifeGoblinProduct } from './index';

const appSource = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
const entrySource = readFileSync(new URL('../../pages/PastLifeEntry.tsx', import.meta.url), 'utf8');
const immersionSource = readFileSync(new URL('../../pages/PastLifeImmersion.tsx', import.meta.url), 'utf8');
const formSource = readFileSync(new URL('../../pages/Form.tsx', import.meta.url), 'utf8');
const checkoutSource = readFileSync(new URL('../../pages/Checkout.tsx', import.meta.url), 'utf8');
const reportSource = readFileSync(new URL('../../pages/Report.tsx', import.meta.url), 'utf8');
const serverReportSource = readFileSync(
  new URL('../../lib/server/geminiReportService.ts', import.meta.url),
  'utf8'
);

const compact = (source: string) => source.replace(/\s+/gu, ' ').trim();

describe('past-life-goblin route and purchase flow contract', () => {
  it('keeps the entry, immersion, about, intake, checkout, and report routes', () => {
    const expectedRoutes = [
      '/detail/past-life-goblin',
      '/detail/past-life-goblin/immersion',
      '/detail/past-life-goblin/about',
      '/form/:id',
      '/checkout',
      '/report/:id'
    ];

    expectedRoutes.forEach((route) => expect(appSource).toContain(`path="${route}"`));
    expect(appSource.match(/<ProductRouteBoundary productId="past-life-goblin">/gu)).toHaveLength(3);
    expect(appSource).toContain('<ProductIntakeRouteBoundary>');
    expect(appSource).toContain('<ProductCheckoutRouteBoundary>');
    expect(appSource).toContain('<HistoricalReportRouteBoundary>');
    expect(pastLifeGoblinProduct.routes).toMatchObject({
      detail: '/detail/past-life-goblin',
      intake: '/form/past-life-goblin',
      checkout: '/checkout',
      report: '/report/past-life-goblin'
    });
    expect(entrySource).toContain('actionHref="/detail/past-life-goblin/immersion"');
    expect(immersionSource).toContain("navigate('/form/past-life-goblin'");
    expect(immersionSource).toContain('to="/form/past-life-goblin"');
  });

  it('keeps the dedicated four-step intake gates before checkout', () => {
    const normalized = compact(formSource);

    expect(formSource).toContain('type IntakeStep = 1 | 2 | 3 | 4;');
    expect(formSource).toContain("const isPastLifeFlow = product.flow.intakeVariant === 'past-life';");
    expect(normalized).toContain(
      'const canSubmit = step1Ready && step2Ready && step3Ready && step4Ready;'
    );
    expect(normalized).toContain('setStep(2); return;');
    expect(normalized).toContain('setStep(3); return;');
    expect(normalized).toContain('setStep(4); return;');
    expect(normalized).toMatch(
      /navigate\('\/checkout', \{ state: \{ product: service\.id, formData: submittedFormData, tabOrigin \} \}\);/u
    );
  });

  it('preserves recovered entitlement and authenticated payment branches', () => {
    const normalizedForm = compact(formSource);
    const normalizedCheckout = compact(checkoutSource);

    expect(normalizedForm).toContain('if (locationState?.recoveredEntitlement) {');
    expect(normalizedForm).toContain(
      'reportAccessToken: locationState.recoveredEntitlement.reportAccessToken'
    );

    expect(checkoutSource).toContain('const product = getProductById(requestedProductId)!;');
    expect(checkoutSource).toContain(
      "const isPastLifeProduct = product.flow.intakeVariant === 'past-life';"
    );
    expect(checkoutSource).toContain('const amount = product.price;');
    expect(normalizedCheckout).toMatch(
      /requestPaymentOrderIntent\(\{ confirmEndpoint, authToken: user\.authToken, orderId, productId: service\.id, amount \}\)/u
    );
    expect(normalizedCheckout).toMatch(
      /confirmAuthenticatedPortOnePayment\(\{[^}]*orderId: orderIntent\.orderId,[^}]*amount,[^}]*productId: service\.id,[^}]*orderClaim: orderIntent\.orderClaim/u
    );
    expect(normalizedCheckout).toContain('reportAccessToken: confirmed.reportAccessToken');
  });

  it('ensures the five-volume product report on paid and server-generated paths', () => {
    const normalizedReport = compact(reportSource);
    const normalizedServer = compact(serverReportSource);

    expect(reportSource).toContain("import { ensurePastLifeGoblinReport } from '../products/past-life-goblin/reportBuilder';");
    expect(normalizedReport).toMatch(
      /if \(reportData\) \{ return finalizePastLife\(reportData\); \}/u
    );
    expect(normalizedReport).toContain(
      'const pastLifeShareCards = createPastLifeShareCards(report);'
    );
    expect(normalizedServer).toContain(
      'const productReport = ensurePastLifeGoblinReport(builtReport);'
    );
  });

  it('uses public, product-only sharing for the past-life report', () => {
    const normalized = compact(reportSource);

    expect(normalized).toMatch(
      /const shareData = isPastLifeShowcase \? createPastLifeProductShareData\(window\.location\.origin\)/u
    );
    expect(normalized).not.toMatch(
      /isPastLifeShowcase\s*\?\s*\{[^}]*customerName[^}]*window\.location\.href/gu
    );
  });
});
