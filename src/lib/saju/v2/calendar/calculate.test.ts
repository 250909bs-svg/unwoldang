import { describe, expect, it } from 'vitest';
import type { IntakeFormData } from '../../../../api/mockData';
import { calcBazi } from '../../baziCalcs';
import { buildBirthCalculation } from './calculate';
import { normalizeIntakeFormToBirthContext } from './normalize';

function intake(overrides: Partial<IntakeFormData> = {}): Partial<IntakeFormData> {
  return {
    name: '테스트',
    gender: 'female',
    calendar: 'solar',
    isLeapMonth: false,
    birthDate: '1992-09-09',
    birthTime: '09:36',
    isUnknownTime: false,
    location: '',
    ...overrides
  };
}

describe('normalizeIntakeFormToBirthContext', () => {
  it('uses safe Korean defaults without inventing coordinates', () => {
    const context = normalizeIntakeFormToBirthContext(intake({ location: '서울' }));
    expect(context.timezone).toEqual({
      id: 'Asia/Seoul',
      utcOffsetMinutes: 540,
      source: 'korea-default'
    });
    expect(context.location).toEqual({
      label: '서울',
      latitude: undefined,
      longitude: undefined,
      source: 'user-text'
    });
    expect(context.trueSolarTime.enabled).toBe(false);
  });

  it('enables correction by default only for caller-supplied verified longitude', () => {
    const context = normalizeIntakeFormToBirthContext(intake(), {
      locationLabel: '서울특별시',
      latitude: 37.5665,
      longitude: 126.978
    });
    expect(context.location?.source).toBe('verified-coordinates');
    expect(context.trueSolarTime.enabled).toBe(true);
  });

  it('fails closed for overseas zones when the historical UTC offset is missing', () => {
    expect(() => normalizeIntakeFormToBirthContext(intake(), {
      timezoneId: 'America/New_York'
    })).toThrow(/UTC 오프셋/);
  });

  it('rejects invalid IANA timezone identifiers', () => {
    expect(() => normalizeIntakeFormToBirthContext(intake(), {
      timezoneId: 'Not/A_Timezone',
      utcOffsetMinutes: 0
    })).toThrow(/IANA 시간대/);
  });

  it('requires an explicit historical offset for pre-1962 Korean births', () => {
    const historical = intake({ birthDate: '1955-01-15', birthTime: '01:20' });

    expect(() => normalizeIntakeFormToBirthContext(historical))
      .toThrow(/역사적 표준시/);
    expect(normalizeIntakeFormToBirthContext(historical, {
      timezoneId: 'Asia/Seoul',
      utcOffsetMinutes: 510
    }).timezone).toMatchObject({ utcOffsetMinutes: 510, source: 'explicit' });
  });

  it('rejects invalid dates and coordinates before calculation', () => {
    expect(() => normalizeIntakeFormToBirthContext(intake({ birthDate: '2023-02-29' })))
      .toThrow(/존재하지/);
    expect(() => normalizeIntakeFormToBirthContext(intake(), { longitude: 181 }))
      .toThrow(/경도/);
  });
});

describe('buildBirthCalculation', () => {
  it('returns a primary chart and audit trace for exact time', () => {
    const result = buildBirthCalculation(intake());
    expect(result.version).toBe('calendar-v2.0.0');
    expect(result.primary).not.toBeNull();
    expect(result.scenarios).toHaveLength(1);
    expect(result.trace).toBe(result.primary?.trace);
    expect(result.primary?.bazi.h_gz?.dz).toBe(5);
    expect(result.trace?.inputTimePrecision).toBe('exact-minute');
    expect(result.trace?.solarTimeCorrection.reason).toBe('disabled');
  });

  it('keeps legacy range uncertainty while calculating its midpoint', () => {
    const result = buildBirthCalculation(intake({ birthTime: '사/巳 (09:30-11:29)' }));
    expect(result.context.time).toMatchObject({
      precision: 'legacy-range',
      hour: 10,
      minute: 30
    });
    expect(result.primary?.bazi.h_gz?.dz).toBe(5);
    expect(result.warnings.join(' ')).toContain('중앙 시각');
  });

  it('returns 12 complete branch charts and no false primary when time is unknown', () => {
    const result = buildBirthCalculation(intake({
      birthTime: '',
      isUnknownTime: true
    }));
    expect(result.primary).toBeNull();
    expect(result.trace).toBeNull();
    expect(result.scenarios).toHaveLength(13);
    expect(result.scenarios.map((scenario) => scenario.bazi.h_gz?.dz)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0
    ]);
  });

  it('applies true-solar correction only with verified longitude', () => {
    const result = buildBirthCalculation(intake({
      birthDate: '2024-06-21',
      birthTime: '00:10',
      location: '서울'
    }), {
      longitude: 127,
      latitude: 37.5,
      applyTrueSolarTime: true,
      includeEquationOfTime: false
    });
    expect(result.trace?.solarTimeCorrection).toMatchObject({
      applied: true,
      longitudeCorrectionMinutes: -32,
      civilDateShift: -1,
      apparentSolarDateTime: {
        year: 2024,
        month: 6,
        day: 20,
        hour: 23,
        minute: 38
      }
    });
  });

  it('records a requested correction as skipped when longitude is unknown', () => {
    const result = buildBirthCalculation(intake({ location: '부산' }), {
      applyTrueSolarTime: true
    });
    expect(result.trace?.solarTimeCorrection.reason).toBe('missing-verified-longitude');
    expect(result.warnings.join(' ')).toContain('경도');
  });

  it('uses the next civil day pillar when the late-zi policy triggers', () => {
    const result = buildBirthCalculation(intake({
      birthDate: '2024-01-01',
      birthTime: '23:30'
    }), {
      dayBoundaryPolicy: 'late-zi-next-day',
      applyTrueSolarTime: false
    });
    const expectedNextDay = calcBazi(2024, 1, 2, 23, 30, 'solar', 'normal', 'female', false);
    expect(result.trace?.dayBoundary).toMatchObject({
      triggered: true,
      effectivePillarDate: { year: 2024, month: 1, day: 2 }
    });
    expect(result.primary?.bazi.d_gz).toEqual(expectedNextDay.d_gz);
    expect(result.primary?.bazi.h_gz).toEqual(expectedNextDay.h_gz);
  });

  it('keeps the 2024 Ipchun minute boundary on apparent solar longitude', () => {
    const before = buildBirthCalculation(intake({
      birthDate: '2024-02-04',
      birthTime: '17:20'
    }));
    const after = buildBirthCalculation(intake({
      birthDate: '2024-02-04',
      birthTime: '17:35'
    }));

    expect(before.primary?.bazi.y_gz).toEqual({ tg: 9, dz: 3 }); // 계묘
    expect(before.primary?.bazi.m_gz).toEqual({ tg: 1, dz: 1 }); // 을축
    expect(after.primary?.bazi.y_gz).toEqual({ tg: 0, dz: 4 }); // 갑진
    expect(after.primary?.bazi.m_gz).toEqual({ tg: 2, dz: 2 }); // 병인
  });

  it('keeps solar-term instant calculation timezone-aware for overseas births', () => {
    const result = buildBirthCalculation(intake({
      birthDate: '2024-01-01',
      birthTime: '12:00'
    }), {
      timezoneId: 'America/New_York',
      utcOffsetMinutes: -300,
      longitude: -75,
      includeEquationOfTime: false
    });
    expect(result.trace?.instantInKst).toEqual({
      year: 2024,
      month: 1,
      day: 2,
      hour: 2,
      minute: 0
    });
    expect(result.trace?.solarTimeCorrection.longitudeCorrectionMinutes).toBe(0);
  });

  it('normalizes lunar input before applying clock policies', () => {
    const result = buildBirthCalculation(intake({
      calendar: 'lunar',
      birthDate: '2024-01-01',
      birthTime: '12:00'
    }));
    expect(result.trace?.inputCalendar).toBe('lunar');
    expect(result.trace?.normalizedSolarDate).not.toEqual({ year: 2024, month: 1, day: 1 });
    expect(result.primary?.bazi.lunar_in).toContain('2024-01-01');
  });
});
