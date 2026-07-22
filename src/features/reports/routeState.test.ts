import { describe, expect, it } from 'vitest';
import { createLegacyGenerationMeta } from './contracts';
import { resolveReportDegradedState } from './routeState';

describe('report platform route state', () => {
  it('keeps an explicit degraded result independent from the provider label', () => {
    expect(resolveReportDegradedState({ reportDegraded: true, reportProvider: 'gemini' })).toBe(true);
    expect(resolveReportDegradedState({ reportDegraded: false, reportProvider: 'deterministic-fallback' })).toBe(false);
  });

  it('uses versioned metadata before the legacy provider fallback', () => {
    expect(resolveReportDegradedState({
      reportGenerationMeta: createLegacyGenerationMeta({ provider: 'deterministic-fallback' }),
      reportProvider: 'gemini'
    })).toBe(true);
    expect(resolveReportDegradedState({ reportProvider: 'deterministic-fallback' })).toBe(true);
  });
});
