import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import vercelConfig from '../../vercel.json';

const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const entrySource = readFileSync(new URL('./CompatibilityEntry.tsx', import.meta.url), 'utf8');
const intakeSource = readFileSync(new URL('./CompatibilityIntake.tsx', import.meta.url), 'utf8');
const homeSource = readFileSync(new URL('./Home.tsx', import.meta.url), 'utf8');
const searchSource = readFileSync(new URL('./Search.tsx', import.meta.url), 'utf8');
const mySource = readFileSync(new URL('./My.tsx', import.meta.url), 'utf8');

describe('compatibility cinematic flow contract', () => {
  it('routes the active compatibility product through teaser and atomic intake screens', () => {
    expect(appSource).toContain('path="/detail/match-couple"');
    expect(appSource).toContain('productId="match-couple"');
    expect(appSource).not.toContain('path="/detail/match-destiny"');
    expect(appSource).toContain('path="/form/match-couple"');
    expect(appSource).not.toContain('path="/form/match-destiny"');
    expect(entrySource).toContain("const PROVISIONAL_COMPATIBILITY_VIDEO = '/signature-intake-hero.mp4'");
    expect(entrySource).toContain("ctaTo={\`/form/\${serviceId}\`}");
    expect(intakeSource).toContain('const TOTAL_STEPS = 11');
    expect(intakeSource).toContain("const BACKGROUND_VIDEO = '/media/mz-love-intake-background.mp4'");
    expect(intakeSource).toContain("navigate('/checkout'");
    expect(intakeSource).not.toContain("navigate('/login'");
  });

  it('uses registry routes for active compatibility and keeps archived destiny unavailable', () => {
    expect(homeSource).toContain('activeProducts.map((product)');
    expect(homeSource).toContain('to: product.routes.detail');
    expect(homeSource).not.toContain("to: '/detail/match-destiny'");
    expect(searchSource).toContain('activeProducts.map((product)');
    expect(searchSource).toContain('to: product.routes.detail');
    expect(mySource).toContain("getProductById('match-couple').routes.detail");

    const retiredIndex = vercelConfig.rewrites.findIndex((item) => item.source === '/detail/:path*');
    const coupleIndex = vercelConfig.rewrites.findIndex((item) => item.source === '/detail/match-couple');
    const destinyIndex = vercelConfig.rewrites.findIndex((item) => item.source === '/detail/match-destiny');
    expect(coupleIndex).toBeGreaterThanOrEqual(0);
    expect(coupleIndex).toBeLessThan(retiredIndex);
    expect(destinyIndex).toBe(-1);
  });
});
