import { describe, expect, it } from 'vitest';
import type { IntakeFormData } from '../../../../api/mockData';
import { buildBirthCalculation } from './calculate';
import { normalizeIntakeFormToBirthContext } from './normalize';
import { resolveHistoricalUtcOffsetMinutes } from './timeZoneValidation';

/** Mirrors the intake: a Korean city with no captured UTC offset. */
function koreanBirth(overrides: Partial<IntakeFormData> = {}): Partial<IntakeFormData> {
  return {
    name: '테스트',
    gender: 'male',
    calendar: 'solar',
    isLeapMonth: false,
    birthDate: '1992-09-09',
    birthTime: '10:24',
    isUnknownTime: false,
    birthTimePrecision: 'exact',
    location: '서울',
    birthLocation: {
      label: '서울',
      latitude: 37.5665,
      longitude: 126.978,
      timezone: 'Asia/Seoul',
      applySolarTimeCorrection: true
    },
    ...overrides
  };
}

const options = { timezoneId: 'Asia/Seoul' } as const;

describe('resolveHistoricalUtcOffsetMinutes', () => {
  it.each([
    ['1953-06-15', 540],
    ['1955-06-15', 570],
    ['1958-06-15', 570],
    ['1961-06-15', 510],
    ['1961-08-11', 540],
    ['1986-07-15', 540],
    ['1987-06-15', 600],
    ['1987-11-15', 540],
    ['1988-07-20', 600],
    ['1992-09-09', 540]
  ])('reads the offset Korea actually observed on %s', (date, expected) => {
    const [year, month, day] = date.split('-').map(Number);
    expect(
      resolveHistoricalUtcOffsetMinutes({ year, month, day, hour: 10, minute: 0 }, 'Asia/Seoul')
    ).toBe(expected);
  });

  it('returns null for a clock that the zone never observed', () => {
    // 1987-05-10 02:00 KST is the daylight-saving gap; the clock is skipped.
    expect(
      resolveHistoricalUtcOffsetMinutes(
        { year: 1987, month: 5, day: 10, hour: 2, minute: 30 },
        'Asia/Seoul'
      )
    ).toBeNull();
  });
});

describe('births in Korea historical-offset windows', () => {
  it.each([
    ['1987 summer time', '1987-07-15', 600],
    ['1988 summer time', '1988-07-20', 600],
    ['1958 UTC+09:30 period', '1958-06-15', 570],
    ['1961 UTC+08:30 period', '1961-06-15', 510]
  ])('normalizes a %s birth without a caller-supplied offset', (_label, birthDate, expected) => {
    const context = normalizeIntakeFormToBirthContext(koreanBirth({ birthDate }), options);

    expect(context.timezone.utcOffsetMinutes).toBe(expected);
    expect(context.timezone.source).toBe('tzdata-historical');
  });

  it.each(['1987-07-15', '1988-07-20', '1958-06-15', '1961-06-15', '1992-09-09'])(
    'produces a full chart for a %s birth',
    (birthDate) => {
      const result = buildBirthCalculation(koreanBirth({ birthDate }), options);

      expect(result.primary).not.toBeNull();
      expect(result.primary?.bazi.d_gz).toBeDefined();
    }
  );

  it('never silently overrides an offset the caller pinned', () => {
    const context = normalizeIntakeFormToBirthContext(
      koreanBirth({ birthDate: '1992-09-09' }),
      { ...options, utcOffsetMinutes: 540 }
    );

    expect(context.timezone.utcOffsetMinutes).toBe(540);
    expect(context.timezone.source).toBe('explicit');
  });

  it('realigns a derived offset to the converted solar date for a lunar birth', () => {
    // Lunar 1987-04-15 converts into the 1987 summer-time window, so the offset
    // read from the lunar input date alone would be the wrong one.
    const result = buildBirthCalculation(
      koreanBirth({ calendar: 'lunar', birthDate: '1987-04-15' }),
      options
    );

    expect(result.context.timezone.utcOffsetMinutes).toBe(600);
    expect(result.primary).not.toBeNull();
  });

  it('keeps a same-day 1992 chart identical to the previous hard-coded +09:00 result', () => {
    const derived = buildBirthCalculation(koreanBirth(), options);
    const pinned = buildBirthCalculation(koreanBirth(), { ...options, utcOffsetMinutes: 540 });

    expect(derived.primary?.bazi.y_gz).toEqual(pinned.primary?.bazi.y_gz);
    expect(derived.primary?.bazi.m_gz).toEqual(pinned.primary?.bazi.m_gz);
    expect(derived.primary?.bazi.d_gz).toEqual(pinned.primary?.bazi.d_gz);
    expect(derived.primary?.bazi.h_gz).toEqual(pinned.primary?.bazi.h_gz);
  });
});
