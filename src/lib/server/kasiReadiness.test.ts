import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../../cloudrun-api/src/config/env';
import { HealthService } from '../../../cloudrun-api/src/domains/health/healthService';

function healthFor(env: Record<string, string>) {
  return new HealthService(loadConfig({
    REPORT_ACCESS_SECRET: 'fixture-report-secret',
    ENABLE_FIRESTORE_ARCHIVE: 'true',
    FIRESTORE_PROJECT_ID: 'fixture-project',
    ...env
  })).getStatus();
}

describe('KASI readiness', () => {
  it('reports lunar conversion ready without claiming special-day readiness', () => {
    expect(healthFor({ KASI_LUNAR_SERVICE_KEY: 'lunar-key' })).toMatchObject({
      kasiLunarConfigured: true,
      kasiSpecialDayConfigured: false,
      readyForLunarReportGeneration: true,
      readyForSolarTermDateVerification: false
    });
  });

  it('reports special-day readiness without claiming lunar report readiness', () => {
    expect(healthFor({ KASI_SPECIALDAY_SERVICE_KEY: 'special-key' })).toMatchObject({
      kasiLunarConfigured: false,
      kasiSpecialDayConfigured: true,
      readyForLunarReportGeneration: false,
      readyForSolarTermDateVerification: true
    });
  });

  it.each([
    'KASI_SERVICE_KEY',
    'DATA_GO_KR_SERVICE_KEY',
    'PUBLIC_DATA_SERVICE_KEY'
  ])('uses %s only as a legacy fallback for both capabilities', (legacyName) => {
    expect(healthFor({ [legacyName]: 'legacy-key' })).toMatchObject({
      kasiLunarConfigured: true,
      kasiSpecialDayConfigured: true,
      readyForLunarReportGeneration: true,
      readyForSolarTermDateVerification: true
    });
  });
});
