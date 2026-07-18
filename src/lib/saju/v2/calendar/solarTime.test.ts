import { describe, expect, it } from 'vitest';
import { applyDayBoundaryPolicy, applyTrueSolarTime, renderInstantInKst } from './solarTime';
import type { BirthContext, CivilDateTime } from './types';

const noon: CivilDateTime = {
  year: 2024,
  month: 6,
  day: 21,
  hour: 12,
  minute: 0
};

function correctionContext(overrides: {
  longitude?: number;
  enabled?: boolean;
  includeEquationOfTime?: boolean;
  offset?: number;
  verified?: boolean;
}): Pick<BirthContext, 'timezone' | 'location' | 'trueSolarTime'> {
  return {
    timezone: {
      id: 'Asia/Seoul',
      utcOffsetMinutes: overrides.offset ?? 540,
      source: 'explicit'
    },
    location: overrides.longitude === undefined
      ? { label: '서울', source: 'user-text' }
      : {
          label: '서울',
          longitude: overrides.longitude,
          source: overrides.verified === false ? 'user-text' : 'verified-coordinates'
        },
    trueSolarTime: {
      enabled: overrides.enabled ?? true,
      includeEquationOfTime: overrides.includeEquationOfTime ?? false
    }
  };
}

describe('true solar time', () => {
  it('has zero longitude correction on the timezone standard meridian', () => {
    const trace = applyTrueSolarTime(noon, correctionContext({ longitude: 135 }));
    expect(trace.applied).toBe(true);
    expect(trace.longitudeCorrectionMinutes).toBe(0);
    expect(trace.apparentSolarDateTime).toEqual(noon);
  });

  it('uses KST meridian and longitude, rolling the date when needed', () => {
    const input = { ...noon, hour: 0, minute: 10 };
    const trace = applyTrueSolarTime(input, correctionContext({ longitude: 127 }));
    expect(trace.longitudeCorrectionMinutes).toBe(-32);
    expect(trace.appliedCorrectionMinutes).toBe(-32);
    expect(trace.apparentSolarDateTime).toEqual({
      year: 2024,
      month: 6,
      day: 20,
      hour: 23,
      minute: 38
    });
    expect(trace.civilDateShift).toBe(-1);
  });

  it('does not treat a city label as verified coordinates', () => {
    const trace = applyTrueSolarTime(noon, correctionContext({}));
    expect(trace).toMatchObject({
      requested: true,
      applied: false,
      reason: 'missing-verified-longitude',
      totalCorrectionMinutes: 0,
      apparentSolarDateTime: noon
    });
  });

  it('does not apply correction when policy is disabled', () => {
    const trace = applyTrueSolarTime(noon, correctionContext({ longitude: 127, enabled: false }));
    expect(trace.reason).toBe('disabled');
    expect(trace.apparentSolarDateTime).toEqual(noon);
  });

  it('optionally includes equation of time with a plausible astronomical bound', () => {
    const trace = applyTrueSolarTime(
      noon,
      correctionContext({ longitude: 135, includeEquationOfTime: true })
    );
    expect(Math.abs(trace.equationOfTimeMinutes)).toBeLessThan(17);
    expect(trace.totalCorrectionMinutes).toBeCloseTo(trace.equationOfTimeMinutes, 8);
  });
});

describe('timezone and day boundary policy', () => {
  it('renders an overseas local instant in KST without changing the physical instant', () => {
    expect(renderInstantInKst({
      year: 2024,
      month: 1,
      day: 1,
      hour: 12,
      minute: 0
    }, -300)).toEqual({
      year: 2024,
      month: 1,
      day: 2,
      hour: 2,
      minute: 0
    });
  });

  it('shifts only 23:00 and later under the late-zi policy', () => {
    const before = applyDayBoundaryPolicy({ ...noon, hour: 22, minute: 59 }, 'late-zi-next-day');
    const atBoundary = applyDayBoundaryPolicy({ ...noon, hour: 23, minute: 0 }, 'late-zi-next-day');
    expect(before.triggered).toBe(false);
    expect(atBoundary).toMatchObject({
      triggered: true,
      shiftDays: 1,
      effectivePillarDate: { year: 2024, month: 6, day: 22 }
    });
  });

  it('keeps 23:xx on the civil date under the midnight policy', () => {
    const trace = applyDayBoundaryPolicy({ ...noon, hour: 23, minute: 59 }, 'civil-midnight');
    expect(trace.triggered).toBe(false);
    expect(trace.effectivePillarDate).toEqual({ year: 2024, month: 6, day: 21 });
  });
});
