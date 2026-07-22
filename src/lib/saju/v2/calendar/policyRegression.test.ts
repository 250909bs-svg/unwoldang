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

describe('commercial calendar policy regressions', () => {
  it('fails closed when a leap-month flag is attached to a solar date', () => {
    expect(() => normalizeIntakeFormToBirthContext(intake({ isLeapMonth: true })))
      .toThrow(/윤달은 음력/);
    expect(() => buildBirthCalculation(intake({ isLeapMonth: true })))
      .toThrow(/윤달은 음력/);
  });

  it('distinguishes a valid lunar leap month from the regular month', () => {
    const regular = buildBirthCalculation(intake({
      calendar: 'lunar',
      birthDate: '2023-02-01',
      isLeapMonth: false,
      birthTime: '12:00'
    }));
    const leap = buildBirthCalculation(intake({
      calendar: 'lunar',
      birthDate: '2023-02-01',
      isLeapMonth: true,
      birthTime: '12:00'
    }));

    expect(regular.trace?.normalizedSolarDate).toEqual({ year: 2023, month: 2, day: 20 });
    expect(leap.trace?.normalizedSolarDate).toEqual({ year: 2023, month: 3, day: 22 });
    expect(leap.primary?.bazi.lunar_in).toContain('윤달');
    expect(() => buildBirthCalculation(intake({
      calendar: 'lunar',
      birthDate: '2024-02-01',
      isLeapMonth: true
    }))).toThrow(/Invalid leap month/);
  });

  it('applies true-solar correction before evaluating the 23:00 boundary', () => {
    const options = {
      longitude: 127,
      applyTrueSolarTime: true,
      includeEquationOfTime: false,
      dayBoundaryPolicy: 'late-zi-next-day' as const
    };
    const before = buildBirthCalculation(intake({
      birthDate: '2024-06-21',
      birthTime: '23:31'
    }), options);
    const atBoundary = buildBirthCalculation(intake({
      birthDate: '2024-06-21',
      birthTime: '23:32'
    }), options);

    expect(before.trace?.solarTimeCorrection.apparentSolarDateTime)
      .toMatchObject({ hour: 22, minute: 59 });
    expect(before.trace?.dayBoundary).toMatchObject({
      triggered: false,
      effectivePillarDate: { year: 2024, month: 6, day: 21 }
    });
    expect(atBoundary.trace?.solarTimeCorrection.apparentSolarDateTime)
      .toMatchObject({ hour: 23, minute: 0 });
    expect(atBoundary.trace?.dayBoundary).toMatchObject({
      triggered: true,
      effectivePillarDate: { year: 2024, month: 6, day: 22 }
    });
  });

  it('orders previous-date solar correction and late-zi rollover deterministically', () => {
    const result = buildBirthCalculation(intake({
      birthDate: '2024-06-21',
      birthTime: '00:10'
    }), {
      longitude: 127,
      applyTrueSolarTime: true,
      includeEquationOfTime: false,
      dayBoundaryPolicy: 'late-zi-next-day'
    });

    expect(result.trace?.solarTimeCorrection.apparentSolarDateTime).toEqual({
      year: 2024,
      month: 6,
      day: 20,
      hour: 23,
      minute: 38
    });
    expect(result.trace?.dayBoundary).toMatchObject({
      triggered: true,
      effectivePillarDate: { year: 2024, month: 6, day: 21 }
    });
    const expected = calcBazi(2024, 6, 21, 23, 38, 'solar', 'normal', 'female', false);
    expect(result.primary?.bazi.d_gz).toEqual(expected.d_gz);
    expect(result.primary?.bazi.h_gz).toEqual(expected.h_gz);
  });

  it('changes the civil-day pillar exactly at midnight under the default policy', () => {
    const before = buildBirthCalculation(intake({
      birthDate: '2024-01-01',
      birthTime: '23:59'
    }));
    const after = buildBirthCalculation(intake({
      birthDate: '2024-01-02',
      birthTime: '00:00'
    }));

    expect(before.trace?.dayBoundary.effectivePillarDate)
      .toEqual({ year: 2024, month: 1, day: 1 });
    expect(after.trace?.dayBoundary.effectivePillarDate)
      .toEqual({ year: 2024, month: 1, day: 2 });
    expect(after.primary?.bazi.d_gz).not.toEqual(before.primary?.bazi.d_gz);
  });
});
