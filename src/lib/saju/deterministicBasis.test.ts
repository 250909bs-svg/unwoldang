import { describe, expect, it } from 'vitest';
import type { IntakeFormData } from '../../api/mockData';
import type { KasiCalendarVerification } from '../server/kasiCalendarService';
import { buildDeterministicSajuBasis } from './deterministicBasis';

function makeFormData(overrides: Partial<IntakeFormData> = {}): Partial<IntakeFormData> {
  return {
    name: '테스터',
    gender: 'female',
    calendar: 'solar',
    isLeapMonth: false,
    birthDate: '1990-01-01',
    birthTime: '12:30',
    isUnknownTime: false,
    relationshipStatus: '',
    relationshipDuration: '',
    location: '서울',
    q1: '올해 흐름이 궁금해요',
    q2: '일에서 어떤 선택이 좋을까요?',
    ...overrides
  };
}

describe('deterministic saju basis', () => {
  it('builds a complete deterministic basis payload for report generation', () => {
    const verification: KasiCalendarVerification = {
      provider: 'KASI',
      enabled: true,
      status: 'verified',
      originalCalendar: 'solar',
      originalBirthDate: '1990-01-01',
      originalIsLeapMonth: false,
      normalizedCalendar: 'solar',
      normalizedSolarDate: '1990-01-01',
      message: 'verified',
      solarTerms: []
    };

    const basis = buildDeterministicSajuBasis('general-signature', makeFormData(), verification);

    expect(basis.service.id).toBe('general-signature');
    expect(basis.service.label.length).toBeGreaterThan(0);
    expect(basis.input.timezone).toBe('Asia/Seoul');
    expect(basis.input.birthDate).toBe('1990-01-01');
    expect(basis.pillars.year.length).toBeGreaterThan(0);
    expect(basis.pillars.month.length).toBeGreaterThan(0);
    expect(basis.pillars.day.length).toBeGreaterThan(0);
    expect(basis.dayun).toHaveLength(10);
    expect(basis.seun).toHaveLength(12);
    expect(basis.helpfulElements.length).toBeGreaterThan(0);
    expect(basis.cautiousElements.length).toBeGreaterThan(0);
    expect(basis.tenGods.length).toBeGreaterThan(0);
    expect(basis.fiveElements.length).toBe(5);
    expect(basis.calendarVerification).toEqual(verification);
    expect(basis.input.questions).toEqual(['올해 흐름이 궁금해요', '일에서 어떤 선택이 좋을까요?']);
  });

  it('sets hour pillar to null when time is unknown', () => {
    const basis = buildDeterministicSajuBasis(
      'general-signature',
      makeFormData({
        isUnknownTime: true,
        birthTime: ''
      })
    );

    expect(basis.input.birthTime).toBeNull();
    expect(basis.pillars.hour).toBeNull();
  });

  it('throws on invalid birth date input', () => {
    expect(() =>
      buildDeterministicSajuBasis(
        'general-signature',
        makeFormData({
          birthDate: '1990/01/01'
        })
      )
    ).toThrow();
  });
});
