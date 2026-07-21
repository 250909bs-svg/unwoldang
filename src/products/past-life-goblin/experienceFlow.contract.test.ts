import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

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
      '<Route path="/detail/past-life-goblin" element={<PastLifeEntry />} />',
      '<Route path="/detail/past-life-goblin/immersion" element={<PastLifeImmersion />} />',
      '<Route path="/detail/past-life-goblin/about" element={<PastLifeLanding />} />',
      '<Route path="/form/:id" element={<Form />} />',
      '<Route path="/checkout" element={<Checkout />} />',
      '<Route path="/report/:id" element={<Report />} />'
    ];

    expectedRoutes.forEach((route) => expect(appSource).toContain(route));
    expect(entrySource).toContain('actionHref="/detail/past-life-goblin/immersion"');
    expect(immersionSource).toContain("navigate('/form/past-life-goblin'");
    expect(immersionSource).toContain('to="/form/past-life-goblin"');
  });

  it('keeps the dedicated four-step intake gates before checkout', () => {
    const normalized = compact(formSource);

    expect(formSource).toContain('type IntakeStep = 1 | 2 | 3 | 4;');
    expect(formSource).toContain("const isPastLifeFlow = service.id === 'past-life-goblin';");
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

    expect(checkoutSource).toContain("const isPastLifeProduct = service.id === 'past-life-goblin';");
    expect(checkoutSource).toContain("const amount = getPriceValue(service?.price || '0');");
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
