import { describe, expect, it } from 'vitest';
import type { IntakeFormData } from '../api/mockData';
import { validateBirthInput, validateIntakeBirthInputs } from './birthInputValidation';

const validExactBirth: Partial<IntakeFormData> = {
  name: '홍길동',
  gender: 'female',
  calendar: 'solar',
  isLeapMonth: false,
  birthDate: '1990-01-01',
  birthTime: '12:30',
  isUnknownTime: false,
  birthTimePrecision: 'exact',
  dayBoundaryPolicy: 'midnight'
};

describe('commercial birth-input preflight', () => {
  it('accepts exact, legacy-range, and unknown time without erasing precision', () => {
    const exact = validateBirthInput(validExactBirth);
    const range = validateBirthInput({
      ...validExactBirth,
      birthTime: '사/巳 (09:30-11:29)',
      birthTimePrecision: 'branch-range'
    });
    const unknown = validateBirthInput({
      ...validExactBirth,
      birthTime: '',
      isUnknownTime: true,
      birthTimePrecision: 'unknown'
    });

    expect(exact.valid).toBe(true);
    expect(exact.calculation?.context.time.precision).toBe('exact-minute');
    expect(range.valid).toBe(true);
    expect(range.calculation?.context.time.precision).toBe('legacy-range');
    expect(unknown.valid).toBe(true);
    expect(unknown.calculation?.primary).toBeNull();
    expect(unknown.calculation?.scenarios.length).toBeGreaterThan(1);
  });

  it('infers precision for old saved payloads but rejects explicit contradictions', () => {
    const legacyPayload = validateBirthInput({
      ...validExactBirth,
      birthTimePrecision: undefined
    });
    const mismatch = validateBirthInput({
      ...validExactBirth,
      birthTimePrecision: 'branch-range'
    });

    expect(legacyPayload.valid).toBe(true);
    expect(legacyPayload.normalizedPrecision).toBe('exact');
    expect(mismatch.valid).toBe(false);
    expect(mismatch.errors).toContainEqual(expect.objectContaining({
      code: 'time_precision_mismatch',
      field: 'birthTimePrecision'
    }));
  });

  it('rejects invalid civil dates and impossible lunar leap months through calendar v2', () => {
    const invalidCivil = validateBirthInput({ ...validExactBirth, birthDate: '2024-02-30' });
    const impossibleLeapMonth = validateBirthInput({
      ...validExactBirth,
      calendar: 'lunar',
      isLeapMonth: true,
      birthDate: '2024-02-01'
    });

    expect(invalidCivil.valid).toBe(false);
    expect(invalidCivil.errors[0]).toEqual(expect.objectContaining({ code: 'calendar_preflight_failed' }));
    expect(impossibleLeapMonth.valid).toBe(false);
    expect(impossibleLeapMonth.errors[0]?.message).toContain('윤달');
  });

  it('rejects leap-month flags on solar dates and invalid runtime boundary policies', () => {
    const solarLeap = validateBirthInput({ ...validExactBirth, isLeapMonth: true });
    const invalidBoundary = validateBirthInput({
      ...validExactBirth,
      dayBoundaryPolicy: 'school-default' as IntakeFormData['dayBoundaryPolicy']
    });

    expect(solarLeap.errors).toContainEqual(expect.objectContaining({
      code: 'leap_month_requires_lunar',
      field: 'isLeapMonth'
    }));
    expect(invalidBoundary.errors).toContainEqual(expect.objectContaining({
      code: 'invalid_value',
      field: 'dayBoundaryPolicy'
    }));
  });

  it('requires and independently preflights the partner for compatibility products', () => {
    const missingPartner = validateIntakeBirthInputs(validExactBirth, { requirePartner: true });
    const invalidPartner = validateIntakeBirthInputs({
      ...validExactBirth,
      partner: {
        name: '상대방',
        gender: 'male',
        calendar: 'solar',
        isLeapMonth: false,
        birthDate: '1992-13-01',
        birthTime: '09:15',
        isUnknownTime: false,
        birthTimePrecision: 'exact',
        dayBoundaryPolicy: 'late-zi'
      }
    }, { requirePartner: true });
    const validPartner = validateIntakeBirthInputs({
      ...validExactBirth,
      partner: {
        name: '상대방',
        gender: 'male',
        calendar: 'solar',
        isLeapMonth: false,
        birthDate: '1992-09-09',
        birthTime: '09:15',
        isUnknownTime: false,
        birthTimePrecision: 'exact',
        dayBoundaryPolicy: 'late-zi'
      }
    }, { requirePartner: true });

    expect(missingPartner.valid).toBe(false);
    expect(missingPartner.partner?.errors[0]?.code).toBe('partner_required');
    expect(invalidPartner.valid).toBe(false);
    expect(invalidPartner.partner?.errors[0]?.code).toBe('calendar_preflight_failed');
    expect(validPartner.valid).toBe(true);
    expect(validPartner.partner?.calculation?.context.dayBoundaryPolicy).toBe('late-zi-next-day');
  });
});
