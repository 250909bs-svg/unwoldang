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

const STEM_HANJA: Record<string, string> = {
  갑: '甲',
  을: '乙',
  병: '丙',
  정: '丁',
  무: '戊',
  기: '己',
  경: '庚',
  신: '辛',
  임: '壬',
  계: '癸'
};

const BRANCH_HANJA: Record<string, string> = {
  자: '子',
  축: '丑',
  인: '寅',
  묘: '卯',
  진: '辰',
  사: '巳',
  오: '午',
  미: '未',
  신: '申',
  유: '酉',
  술: '戌',
  해: '亥'
};

function toHanjaGanzhi(ganzhi: string | null) {
  if (!ganzhi) return null;
  const [stem, branch] = [...ganzhi];
  return `${STEM_HANJA[stem] || stem}${BRANCH_HANJA[branch] || branch}`;
}

function findDayunForAge(dayun: Array<{ age: string; ganzhi: string }>, age: number) {
  return dayun.find((row) => {
    const match = row.age.match(/(\d+)\D+(\d+)/);
    if (!match) return false;
    const start = Number(match[1]);
    const end = Number(match[2]);
    return age >= start && age <= end;
  });
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

  it('locks the Cha Minho launch regression values', () => {
    const basis = buildDeterministicSajuBasis(
      'general-signature',
      makeFormData({
        name: '차민호',
        gender: 'male',
        calendar: 'solar',
        birthDate: '1992-09-09',
        birthTime: '10:24',
        isUnknownTime: false
      })
    );

    expect(toHanjaGanzhi(basis.pillars.year)).toBe('壬申');
    expect(toHanjaGanzhi(basis.pillars.month)).toBe('己酉');
    expect(toHanjaGanzhi(basis.pillars.day)).toBe('戊子');
    expect(toHanjaGanzhi(basis.pillars.hour)).toBe('丁巳');
    expect(Object.fromEntries(basis.fiveElements.map((item) => [item.label, item.value]))).toEqual({
      목: 0,
      화: 2,
      토: 2,
      금: 2,
      수: 2
    });

    const currentAge = new Date().getFullYear() - 1992 + 1;
    const currentDayun = findDayunForAge(basis.dayun, currentAge);
    const nextDayun = basis.dayun[basis.dayun.findIndex((row) => row === currentDayun) + 1];
    expect(toHanjaGanzhi(currentDayun?.ganzhi || null)).toBe('壬子');
    expect(toHanjaGanzhi(nextDayun?.ganzhi || null)).toBe('癸丑');
    expect(basis.seun.slice(0, 5).map((item) => toHanjaGanzhi(item.ganzhi))).toEqual(['丙午', '丁未', '戊申', '己酉', '庚戌']);
    expect(basis.visibleTenGods.map((item) => item.reading)).toEqual([
      '壬 편재 / 申 식신',
      '己 겁재 / 酉 상관',
      '戊 비견 / 子 정재',
      '丁 정인 / 巳 편인'
    ]);
    expect(basis.tenGodBasisNote).toContain('지장간 포함 기준');
  });
});
