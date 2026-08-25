import { describe, expect, it } from 'vitest';
import type { IntakeFormData } from '../../api/mockData';
import { buildDeterministicSajuBasis } from './deterministicBasis';
import { buildSajuReport } from './reportBuilder';
import { findCustomerReportTextViolations } from './reportPresentation';

const seoul = {
  label: '서울특별시',
  timezone: 'Asia/Seoul',
  utcOffsetMinutes: 540,
  latitude: 37.5665,
  longitude: 126.978,
  applySolarTimeCorrection: false
};

const base: IntakeFormData = {
  name: '출시검증',
  gender: 'female',
  calendar: 'solar',
  isLeapMonth: false,
  birthDate: '1992-09-09',
  birthTime: '10:24',
  isUnknownTime: false,
  birthTimePrecision: 'exact',
  dayBoundaryPolicy: 'midnight',
  birthLocation: seoul,
  timezone: 'Asia/Seoul',
  utcOffsetMinutes: 540,
  latitude: 37.5665,
  longitude: 126.978,
  applySolarTimeCorrection: false,
  location: '서울특별시',
  relationshipStatus: 'single',
  relationshipDuration: '',
  q1: '올해 가장 먼저 정리할 선택은 무엇인가요?',
  q2: '돈과 관계에서 반복하는 실수는 무엇인가요?'
};

const fixtures: Array<{ id: string; input: IntakeFormData }> = [
  {
    id: 'ipchun-before',
    input: { ...base, birthDate: '2024-02-04', birthTime: '12:00' }
  },
  {
    id: 'ipchun-after',
    input: { ...base, birthDate: '2024-02-04', birthTime: '20:00' }
  },
  {
    id: 'summer-hot',
    input: { ...base, gender: 'male', birthDate: '1995-07-15', birthTime: '13:25' }
  },
  {
    id: 'winter-cold',
    input: { ...base, birthDate: '1987-12-21', birthTime: '05:40' }
  },
  {
    id: 'midnight-0005',
    input: { ...base, birthDate: '2001-03-03', birthTime: '00:05' }
  },
  {
    id: 'late-zi-2330',
    input: { ...base, birthDate: '2024-01-01', birthTime: '23:30', dayBoundaryPolicy: 'late-zi' }
  },
  {
    id: 'unknown-time',
    input: { ...base, birthTime: '', isUnknownTime: true, birthTimePrecision: 'unknown' }
  },
  {
    id: 'branch-range',
    input: {
      ...base,
      birthTime: '사/巳 (09:30-11:29)',
      birthTimePrecision: 'branch-range'
    }
  },
  {
    id: 'lunar-leap',
    input: { ...base, calendar: 'lunar', isLeapMonth: true, birthDate: '2023-02-01' }
  },
  {
    id: 'overseas-timezone',
    input: {
      ...base,
      birthDate: '1989-11-05',
      birthTime: '01:15',
      birthLocation: {
        label: '뉴욕',
        timezone: 'America/New_York',
        utcOffsetMinutes: -300,
        latitude: 40.7128,
        longitude: -74.006,
        applySolarTimeCorrection: false
      },
      timezone: 'America/New_York',
      utcOffsetMinutes: -300,
      latitude: 40.7128,
      longitude: -74.006,
      location: '뉴욕'
    }
  }
];

function immutableCalculation(input: IntakeFormData) {
  const basis = buildDeterministicSajuBasis('general-signature', input);
  return {
    pillars: basis.pillars,
    fiveElements: basis.fiveElements,
    tenGods: basis.tenGods,
    yunseong: basis.yunseong,
    dayun: basis.dayun,
    seun: basis.seun,
    precision: basis.commercialV2.calendar.precision,
    policy: basis.commercialV2.calendar.dayBoundaryPolicy
  };
}

describe('general-signature 1,000-run release stress matrix', () => {
  it('repeats 10 boundary fixtures 100 times without calculation drift', () => {
    const golden = new Map(fixtures.map(({ id, input }) => [id, immutableCalculation(input)]));
    let checked = 0;

    for (let round = 0; round < 100; round += 1) {
      fixtures.forEach(({ id, input }) => {
        const actual = immutableCalculation(input);
        expect(actual).toEqual(golden.get(id));
        expect(actual.pillars.year).toBeTruthy();
        expect(actual.pillars.month).toBeTruthy();
        expect(actual.pillars.day).toBeTruthy();
        if (!input.isUnknownTime && input.birthTimePrecision !== 'branch-range') {
          expect(actual.pillars.hour).toBeTruthy();
        }
        checked += 1;
      });
    }

    expect(checked).toBe(1_000);
  }, 60_000);

  it.each(fixtures)('$id produces a complete customer report without text violations', ({ input }) => {
    const report = buildSajuReport('general-signature', input);
    const visible = JSON.stringify({
      ...report,
      engineMeta: undefined,
      qualityAudit: undefined
    });

    expect(report.sections.length).toBeGreaterThan(15);
    expect(report.sections.every((section) => {
      const body = (section.paragraphs?.join('') || '')
        + (section.bullets?.join('') || '')
        + (section.cards?.map((card) => `${card.title}${card.body}`).join('') || '')
        + (section.details?.map((detail) => `${detail.summary}${detail.content}`).join('') || '')
        + (section.callout?.body || '')
        + (section.table?.rows.flat().join('') || '');
      return body.trim().length > 0;
    })).toBe(true);
    expect(findCustomerReportTextViolations(report)).toEqual([]);
    expect(visible).not.toMatch(/고객 체감|읽는 사람이|상담받는 느낌|30 SECOND BRIEFING|TIME DESIGN/i);
    expect(visible).not.toMatch(/1인 브랜드|상담형 (?:상품|서비스)|개인 맞춤 리포트|디지털 리포트|후속 질문권|월간 점검|B2B 운영|2,900원 유입|9,900원 주력|34,900원 심층|파일럿 고객/);
  });
});
