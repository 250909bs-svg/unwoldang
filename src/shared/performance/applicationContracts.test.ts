import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readProjectFile = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

const appSource = readProjectFile('src/App.tsx');
const homeSource = readProjectFile('src/pages/Home.tsx');
const searchSource = readProjectFile('src/pages/Search.tsx');
const checkoutSource = readProjectFile('src/pages/Checkout.tsx');
const formSource = readProjectFile('src/pages/Form.tsx');
const reportSource = readProjectFile('src/pages/Report.tsx');
const indexStyles = readProjectFile('src/index.css');
const pastLifeStyles = readProjectFile('src/styles/past-life.css');
const loveReportStyles = readProjectFile('src/styles/mz-love-report.css');
const documentSource = readProjectFile('index.html');
const packageSource = readProjectFile('package.json');

describe('application accessibility and mobile contracts', () => {
  it('keeps edge-to-edge viewports safe and removes checkout global chrome', () => {
    expect(documentSource).toContain('viewport-fit=cover');
    expect(indexStyles).toContain('var(--ui-safe-area-top)');
    expect(indexStyles).toContain('safe-area-inset-bottom');
    expect(appSource).toContain('isCheckoutRoute');
    expect(appSource).toContain('|| isCheckoutRoute}');
  });

  it('associates high-traffic form controls and restores Search focus after clearing', () => {
    expect(formSource).toContain('aria-label="생년월일 8자리"');
    expect(formSource).toContain('aria-label="출생 시간대"');
    expect(formSource).toContain("aria-pressed={formData.calendar === 'solar'}");
    expect(searchSource).toContain('searchInputRef.current?.focus()');
  });
});

describe('application performance contracts', () => {
  const optimizedImages = [
    'home-yearly-fortune-card.webp',
    'home-concern-reading-card.webp',
    'home-love-reunion-card.webp',
    'home-match-couple-card.webp',
    'intake-sunlight-girl.webp',
    'intake-beauty-red.webp',
    'intake-night-blue.webp',
    'intake-lantern-night.webp',
    'intake-blossom-girl.webp',
    'my-kakao-login-hero.webp'
  ];

  it('ships every optimized image referenced by high-traffic pages', () => {
    for (const image of optimizedImages) {
      expect(existsSync(new URL(`../../../public/${image}`, import.meta.url)), image).toBe(true);
    }

    expect(homeSource).toContain('getOptimizedHomeImage');
    expect(searchSource).toContain('getOptimizedSearchImage');
    expect(checkoutSource).toContain('/intake-beauty-red.webp');
    expect(formSource).toContain('/intake-sunlight-girl.webp');
  });

  it('keeps the past-life story in a lazy route chunk', () => {
    expect(reportSource).toContain("const PastLifeStoryReport = lazy(() => import('../components/PastLifeStoryReport'))");
    expect(reportSource).toContain('<Suspense');
  });

  it('disables render containment for print and exported report clones', () => {
    for (const source of [indexStyles, pastLifeStyles, loveReportStyles]) {
      expect(source).toContain('content-visibility: auto');
      expect(source).toContain('content-visibility: visible');
    }

    expect(indexStyles).toContain('.is-export-static');
    expect(indexStyles).toContain('@media print');
  });

  it('enforces the bundle guard as part of the production build', () => {
    expect(packageSource).toContain('node scripts/check-bundle-budget.mjs');
  });
});
