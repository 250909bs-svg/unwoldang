import { describe, expect, it } from 'vitest';
import type { IntakeFormData } from '../api/mockData';
import { getIntakeFlowDiagnostics, normalizeIntakeFormData } from './intakeDataContract';
import { getRelationshipSummary } from './relationshipIntake';

const base: IntakeFormData = {
  name: '김민호',
  gender: 'male',
  calendar: 'solar',
  isLeapMonth: false,
  birthDate: '1992-09-09',
  birthTime: '9:36',
  isUnknownTime: false,
  birthTimePrecision: 'exact',
  dayBoundaryPolicy: 'late-zi',
  birthLocation: {
    label: '서울특별시',
    timezone: 'Asia/Seoul',
    utcOffsetMinutes: 540,
    latitude: 37.5665,
    longitude: 126.978,
    applySolarTimeCorrection: true
  },
  location: '서울특별시',
  timezone: 'Asia/Seoul',
  utcOffsetMinutes: 540,
  latitude: 37.5665,
  longitude: 126.978,
  applySolarTimeCorrection: true,
  relationshipStatus: 'dating',
  relationshipDuration: 'under3',
  q1: '지금 직업에서 가장 먼저 바꿀 것은 무엇인가요?',
  q2: '앞으로 돈을 남기려면 무엇을 주의해야 하나요?'
};

describe('intake data preservation contract', () => {
  it('preserves and canonicalizes every exact-time field used after payment', () => {
    const result = normalizeIntakeFormData(base);

    expect(result).toMatchObject({
      ...base,
      birthTime: '09:36',
      birthTimePrecision: 'exact',
      isUnknownTime: false
    });
    expect(result.birthLocation).toEqual(base.birthLocation);
    expect(getIntakeFlowDiagnostics(result)).toEqual({
      hasBirthDate: true,
      birthTimePrecision: 'exact',
      hasBirthLocation: true,
      calendar: 'solar',
      hasQuestions: true
    });
  });

  it('keeps branch ranges as ranges instead of promoting them to exact time', () => {
    const result = normalizeIntakeFormData({
      ...base,
      birthTime: '사/巳 (09:30-11:29)',
      birthTimePrecision: 'branch-range'
    });

    expect(result).toMatchObject({
      birthTime: '사/巳 (09:30-11:29)',
      birthTimePrecision: 'branch-range',
      isUnknownTime: false
    });
  });

  it('limits unknown-time handling to the time fields without erasing birth facts', () => {
    const result = normalizeIntakeFormData({
      ...base,
      birthTime: '09:36',
      birthTimePrecision: 'unknown',
      isUnknownTime: true
    });

    expect(result).toMatchObject({
      name: base.name,
      birthDate: base.birthDate,
      calendar: base.calendar,
      birthTime: '',
      birthTimePrecision: 'unknown',
      isUnknownTime: true,
      birthLocation: base.birthLocation
    });
  });

  it('preserves a single-period answer in the canonical relationship summary', () => {
    const result = normalizeIntakeFormData({
      ...base,
      relationshipStatus: 'single',
      relationshipDuration: 'under1'
    });

    expect(result.relationshipDuration).toBe('under1');
    expect(getRelationshipSummary(result)).toBe('솔로 / 솔로 기간 1년 미만');
    expect(getRelationshipSummary(base)).toBe('연애 중 / 1년 이상 3년 이하');
  });
});
