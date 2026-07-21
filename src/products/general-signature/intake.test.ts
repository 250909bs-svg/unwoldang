import { describe, expect, it } from 'vitest';
import type { IntakeFormData } from '../../api/mockData';
import { getGeneralSignatureDevPreviewFormData } from './fixtures';
import {
  applyGeneralSignatureCalendarSelection,
  formatGeneralSignatureBirthDate,
  getGeneralSignatureInputPolicySummary,
  isGeneralSignatureRelationshipReady,
  normalizeGeneralSignatureBirthFields,
  resolveGeneralSignatureIntakeConfig
} from './intake';

function makeForm(overrides: Partial<IntakeFormData> = {}): IntakeFormData {
  return {
    name: '테스트',
    gender: 'female',
    calendar: 'solar',
    isLeapMonth: false,
    birthDate: '2024-02-29',
    birthTime: '10:24',
    isUnknownTime: false,
    birthTimePrecision: 'exact',
    dayBoundaryPolicy: 'midnight',
    relationshipStatus: 'single',
    relationshipDuration: '',
    location: '',
    q1: '첫 질문',
    q2: '두 번째 질문',
    ...overrides
  };
}

describe('general-signature birth intake', () => {
  it('validates solar shape while preserving a valid lunar day 30 for engine preflight', () => {
    expect(formatGeneralSignatureBirthDate('20240229', 'solar')).toBe('2024-02-29');
    expect(formatGeneralSignatureBirthDate('20240230', 'solar')).toBe('');
    expect(formatGeneralSignatureBirthDate('20240230', 'lunar')).toBe('2024-02-30');
    expect(formatGeneralSignatureBirthDate('20240231', 'lunar')).toBe('');
  });

  it('reformats the current digits when the calendar changes', () => {
    const lunar = applyGeneralSignatureCalendarSelection(makeForm({ birthDate: '' }), '20240230', 'lunar');
    const solar = applyGeneralSignatureCalendarSelection({ ...lunar, isLeapMonth: true }, '20240229', 'solar');

    expect(lunar.birthDate).toBe('2024-02-30');
    expect(solar.birthDate).toBe('2024-02-29');
    expect(solar.isLeapMonth).toBe(false);
  });

  it('repairs stale draft combinations without changing calculation formulas', () => {
    const normalized = normalizeGeneralSignatureBirthFields({
      calendar: 'solar',
      isLeapMonth: true,
      birthTime: '22:10',
      isUnknownTime: true,
      birthTimePrecision: 'exact',
      dayBoundaryPolicy: 'unexpected' as IntakeFormData['dayBoundaryPolicy']
    });

    expect(normalized.isLeapMonth).toBe(false);
    expect(normalized.birthTime).toBe('');
    expect(normalized.birthTimePrecision).toBe('unknown');
    expect(normalized.dayBoundaryPolicy).toBe('midnight');
  });

  it('requires relationship duration only for dating and married contexts', () => {
    expect(isGeneralSignatureRelationshipReady(makeForm({ relationshipStatus: 'single' }))).toBe(true);
    expect(isGeneralSignatureRelationshipReady(makeForm({ relationshipStatus: 'situationship' }))).toBe(true);
    expect(isGeneralSignatureRelationshipReady(makeForm({ relationshipStatus: 'dating' }))).toBe(false);
    expect(isGeneralSignatureRelationshipReady(makeForm({ relationshipStatus: 'dating', relationshipDuration: 'under1' }))).toBe(true);
  });

  it('resolves the config only for the exact contracted id', () => {
    expect(resolveGeneralSignatureIntakeConfig('general-signature')).not.toBeNull();
    expect(resolveGeneralSignatureIntakeConfig('love-reading')).toBeNull();
    expect(resolveGeneralSignatureIntakeConfig('typo')).toBeNull();
  });

  it('summarizes the selected lunar, unknown-time, and late-zi policies', () => {
    const summary = getGeneralSignatureInputPolicySummary(makeForm({
      calendar: 'lunar',
      isLeapMonth: true,
      birthTime: '',
      isUnknownTime: true,
      birthTimePrecision: 'unknown',
      dayBoundaryPolicy: 'late-zi'
    }));

    expect(summary.calendar).toBe('음력 · 윤달');
    expect(summary.birthTime).toContain('시주 단정 안 함');
    expect(summary.dayBoundary).toContain('23:00~23:59 익일');
  });

  it('marks an unselected birth time instead of implying a range was chosen', () => {
    const summary = getGeneralSignatureInputPolicySummary(makeForm({
      birthTime: '',
      birthTimePrecision: 'branch-range'
    }));

    expect(summary.birthTime).toBe('출생 시각 선택 필요');
  });

  it('keeps preview fixture disabled outside development', () => {
    expect(getGeneralSignatureDevPreviewFormData(false)).toBeUndefined();
    expect(getGeneralSignatureDevPreviewFormData(true)?.name).toBe('개발용 샘플');
  });
});
