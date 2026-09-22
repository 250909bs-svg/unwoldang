import { describe, expect, it } from 'vitest';
import { buildCommercialReleaseAudit, type CommercialReleaseAuditInput } from './commercialAudit';

function makeInput(overrides: Partial<CommercialReleaseAuditInput> = {}): CommercialReleaseAuditInput {
  return {
    serviceId: 'general-signature',
    engineVersion: 'engine-v1',
    calendarVersion: 'calendar-v1',
    interpretationVersion: 'interpretation-v1',
    birthDate: '1992-09-09',
    birthTime: '10:24',
    calendar: 'solar',
    timezoneId: 'Asia/Seoul',
    utcOffsetMinutes: 540,
    dayBoundaryPolicy: 'civil-midnight',
    precision: 'exact-minute',
    stableSelection: 'primary',
    scenarioPillars: [{ id: 'exact', day: '무자' }],
    pillars: { year: '임신', month: '기유', day: '무자', hour: '정사' },
    trueSolarTime: { requested: false, applied: false },
    externalDayComparable: true,
    calendarVerification: {
      provider: 'KASI',
      enabled: true,
      status: 'verified',
      originalCalendar: 'solar',
      originalBirthDate: '1992-09-09',
      originalIsLeapMonth: false,
      normalizedCalendar: 'solar',
      normalizedSolarDate: '1992-09-09',
      lunarCalendarVerification: {
        enabled: true, status: 'verified', message: 'verified'
      },
      solarTermVerification: {
        enabled: true, status: 'verified', message: 'verified'
      },
      lunar: { dayGanji: '무자(戊子)' }
    },
    interpretationResolved: true,
    helpfulElementSource: 'expert-consensus',
    evidenceCount: 24,
    ...overrides
  };
}

describe('commercial release audit', () => {
  it('is reproducible for identical inputs and changes with calculation policy', () => {
    const first = buildCommercialReleaseAudit(makeInput());
    const second = buildCommercialReleaseAudit(makeInput());
    const changed = buildCommercialReleaseAudit(makeInput({ dayBoundaryPolicy: 'late-zi-next-day' }));

    expect(first.reproducibilityFingerprint).toBe(second.reproducibilityFingerprint);
    expect(changed.reproducibilityFingerprint).not.toBe(first.reproducibilityFingerprint);
    expect(first.decision).toBe('eligible');
    expect(first.evidenceCoverage).toEqual({ score: 1, passed: 8, total: 8 });
  });

  it('blocks an external day-pillar mismatch', () => {
    const audit = buildCommercialReleaseAudit(makeInput({
      calendarVerification: {
        ...makeInput().calendarVerification!,
        lunar: { dayGanji: '기축(己丑)' }
      }
    }));

    expect(audit.externalCalendar.status).toBe('mismatched');
    expect(audit.decision).toBe('blocked');
    expect(audit.blockers.join(' ')).toContain('일치하지 않습니다');
  });

  it('records unavailable external verification as INFO without blocking a stable solar chart', () => {
    const audit = buildCommercialReleaseAudit(makeInput({ calendarVerification: undefined }));

    expect(audit.externalCalendar.status).toBe('not-configured');
    expect(audit.decision).toBe('eligible');
    expect(audit.reviewFlags).toEqual([]);
    expect(audit.infoFlags).toContain(audit.externalCalendar.message);
  });
});

describe('yongsin school divergence policy', () => {
  it('keeps an unresolved yongsin consensus eligible and discloses it as INFO', () => {
    const audit = buildCommercialReleaseAudit(makeInput({
      interpretationResolved: false,
      helpfulElementSource: 'legacy-fallback'
    }));

    // School-level divergence is normal myeongri, not a calculation defect, so it
    // must not hold back release. It still has to reach the customer as a caveat.
    expect(audit.decision).toBe('eligible');
    expect(audit.reviewFlags).toEqual([]);
    expect(audit.infoFlags.join(' ')).toContain('단일 확정 용신으로 승격하지 않았습니다');
    expect(audit.infoFlags.join(' ')).toContain('억부');
  });

  it('still reports the failed checks in evidence coverage', () => {
    const audit = buildCommercialReleaseAudit(makeInput({
      interpretationResolved: false,
      helpfulElementSource: 'legacy-fallback'
    }));

    expect(audit.evidenceCoverage.passed).toBe(6);
    expect(audit.evidenceCoverage.total).toBe(8);
  });

  it('keeps genuine calculation problems blocking', () => {
    expect(buildCommercialReleaseAudit(makeInput({ stableSelection: 'unstable-day' })).decision)
      .toBe('blocked');
    expect(buildCommercialReleaseAudit(makeInput({ evidenceCount: 0 })).decision)
      .toBe('blocked');
  });

  it('keeps an unapplied true-solar-time request in manual review', () => {
    const audit = buildCommercialReleaseAudit(makeInput({
      trueSolarTime: { requested: true, applied: false }
    }));

    expect(audit.decision).toBe('manual-review-required');
  });
});
