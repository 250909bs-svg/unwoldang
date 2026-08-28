import { describe, expect, it } from 'vitest';
import type { RelationEvidence, RelationKind } from '../../lib/saju/v2/interactions';
import {
  MATCH_COUPLE_CONTEXT_VERSION,
  type MatchCoupleContext,
  type MatchCoupleStoredFormData
} from './types';
import { buildMatchCoupleReportModel, groupMatchCoupleRelations } from './analysis';

import { isMatchCoupleReportModel } from './modelValidation';
const SEOUL = {
  label: '서울',
  latitude: 37.5665,
  longitude: 126.978,
  timezone: 'Asia/Seoul',
  utcOffsetMinutes: 540,
  applySolarTimeCorrection: true
} as const;

interface FixtureOverrides {
  self?: Partial<MatchCoupleStoredFormData>;
  partner?: Partial<NonNullable<MatchCoupleStoredFormData['partner']>>;
  context?: Partial<MatchCoupleContext>;
}

function fixture(overrides: FixtureOverrides = {}): Partial<MatchCoupleStoredFormData> {
  const context: MatchCoupleContext = {
    version: MATCH_COUPLE_CONTEXT_VERSION,
    relationshipStatus: 'dating',
    relationshipDuration: 'under3',
    majorConflict: '연락이 늦을 때 서로의 의도를 단정해 다툽니다.',
    desiredInsight: '생활과 돈 문제를 오래 맞출 수 있는지 알고 싶습니다.',
    questions: [
      '갈등 뒤에 어떻게 다시 대화를 시작하면 좋을까요?',
      '장기 관계에서 역할과 돈을 어떻게 나누면 좋을까요?'
    ],
    selfLocationUnknown: false,
    partnerLocationUnknown: false,
    selfSolarTimeCorrectionRequested: false,
    partnerSolarTimeCorrectionRequested: false,
    ...overrides.context
  };

  return {
    name: '하늘',
    gender: 'female',
    calendar: 'solar',
    isLeapMonth: false,
    birthDate: '1992-09-09',
    birthTime: '10:24',
    isUnknownTime: false,
    birthTimePrecision: 'exact',
    dayBoundaryPolicy: 'midnight',
    birthLocation: SEOUL,
    location: '서울',
    relationshipStatus: 'dating',
    relationshipDuration: 'under3',
    q1: '서버 전달용 질문 1',
    q2: '서버 전달용 질문 2',
    ...overrides.self,
    partner: {
      name: '바다',
      gender: 'male',
      calendar: 'solar',
      isLeapMonth: false,
      birthDate: '1989-04-12',
      birthTime: '08:15',
      isUnknownTime: false,
      birthTimePrecision: 'exact',
      dayBoundaryPolicy: 'midnight',
      birthLocation: SEOUL,
      ...overrides.partner,
      ...overrides.self?.partner
    },
    matchCoupleContext: {
      ...context,
      ...overrides.self?.matchCoupleContext
    }
  };
}

function relation(kind: RelationKind, id: string): RelationEvidence {
  return {
    id,
    relation: kind,
    name: `관계 ${id}`,
    subtype: `세부 ${id}`,
    polarity: kind === 'six-combination' ? 'integrative' : 'friction',
    participants: [],
    description: `personA와 personB 사이 ${id}`,
    confidence: 0.9,
    uncertainty: [`${id} 해석 유보`]
  };
}

function objectKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(objectKeys);
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, item]) => [key, ...objectKeys(item)]);
}

describe('match-couple deterministic analysis', () => {
  it('builds every required qualitative section from two stable charts', () => {
    const input = fixture();
    const report = buildMatchCoupleReportModel(input);

    expect(report.version).toBe('match-couple-report-v1');
    expect(isMatchCoupleReportModel(report)).toBe(true);
    expect(report.people[0]).not.toBeNull();
    expect(report.people[1]).not.toBeNull();
    expect(report.people[0]?.fiveElements).toHaveLength(5);
    expect(report.people[0]?.tenGods).toHaveLength(10);
    expect(report.people[0]?.spousePalace.branch).toHaveLength(1);
    expect(report.overview).not.toBeNull();
    expect(report.guidance).not.toBeNull();
    expect(Object.keys(report.guidance || {})).toEqual([
      'attraction',
      'emotionalExpression',
      'communication',
      'conflictRecovery',
      'dailyLife',
      'money',
      'longTermRoles'
    ]);
    expect(report.relations.map((group) => group.label)).toEqual(['합', '충', '형', '파', '해']);
    expect(report.cautionWords.length).toBeGreaterThanOrEqual(3);
    expect(report.cautionActions.length).toBeGreaterThanOrEqual(3);
    expect(report.relationshipRules).toHaveLength(5);
    expect(report.experiment.map((item) => item.days)).toEqual([
      '1~7일',
      '8~14일',
      '15~21일',
      '22~30일'
    ]);
    expect(report.questions).toEqual(input.matchCoupleContext?.questions);
    expect(report.questions[0]).not.toContain('[궁합 관계 맥락]');
    expect(report.evidenceIds.length).toBeGreaterThan(0);
    expect(report.generatedFrom).toEqual({
      calendarEngine: 'calendar-v2.0.0',
      compatibilityEngine: '2.0.0'
    });
  });

  it('returns exactly the same model for the same input and exposes no score field', () => {
    const input = fixture();
    const first = buildMatchCoupleReportModel(input);
    const second = buildMatchCoupleReportModel(input);

    expect(second).toEqual(first);
    expect(objectKeys(first).some((key) => key.toLowerCase() === 'score')).toBe(false);
    expect(JSON.stringify(first)).not.toContain('"score"');
  });

  it('keeps a stable core for unknown time while excluding the hour pillar', () => {
    const input = fixture({
      self: {
        birthTime: '',
        isUnknownTime: true,
        birthTimePrecision: 'unknown',
        birthLocation: undefined,
        location: ''
      },
      context: { selfLocationUnknown: true }
    });
    const report = buildMatchCoupleReportModel(input);

    expect(report.people[0]).not.toBeNull();
    expect(report.people[0]?.pillars.hour).toBeNull();
    expect(report.people[0]?.availability.status).toBe('limited');
    expect(report.guidance).not.toBeNull();
    expect(report.generatedFrom.compatibilityEngine).toBe('2.0.0');
    expect(report.limitations.join(' ')).toContain('시주');
    expect(report.limitations.join(' ')).toContain('진태양시 보정');
  });

  it('restores requested solar correction and withholds an unstable unknown-time day pillar', () => {
    const report = buildMatchCoupleReportModel(fixture({
      self: {
        birthTime: '',
        isUnknownTime: true,
        birthTimePrecision: 'unknown',
        birthLocation: { ...SEOUL, applySolarTimeCorrection: false }
      },
      context: { selfSolarTimeCorrectionRequested: true }
    }));

    expect(report.people[0]).toBeNull();
    expect(report.guidance).toBeNull();
    expect(report.generatedFrom.compatibilityEngine).toBeNull();
    expect(report.limitations.join(' ')).toContain('일주');
  });

  it('marks a place without correction coordinates as limited', () => {
    const report = buildMatchCoupleReportModel(fixture({
      self: {
        birthLocation: {
          label: '기타 지역',
          timezone: 'Asia/Seoul',
          utcOffsetMinutes: 540,
          applySolarTimeCorrection: false
        },
        location: '기타 지역'
      }
    }));

    expect(report.people[0]).not.toBeNull();
    expect(report.people[0]?.availability.status).toBe('limited');
    expect(report.people[0]?.availability.note).toContain('보정 기준');
    expect(report.limitations.join(' ')).toContain('좌표 또는 보정 기준');
  });

  it('withholds person facts and full compatibility when unknown time changes the day pillar', () => {
    const input = fixture({
      self: {
        birthTime: '',
        isUnknownTime: true,
        birthTimePrecision: 'unknown',
        dayBoundaryPolicy: 'late-zi',
        birthLocation: undefined,
        location: ''
      },
      context: { selfLocationUnknown: true }
    });
    const report = buildMatchCoupleReportModel(input);

    expect(report.people[0]).toBeNull();
    expect(report.people[1]).not.toBeNull();
    expect(report.overview).toBeNull();
    expect(report.guidance).toBeNull();
    expect(report.generatedFrom.compatibilityEngine).toBeNull();
    expect(report.relations.every((group) => group.items.length === 0)).toBe(true);
    expect(report.limitations.join(' ')).toContain('일주');
    expect(report.limitations.join(' ')).toContain('유보');
  });

  it('returns limitations instead of throwing when a present date cannot be calculated', () => {
    const report = buildMatchCoupleReportModel(fixture({
      self: { birthDate: 'not-a-date' }
    }));

    expect(report.people[0]).toBeNull();
    expect(report.guidance).toBeNull();
    expect(report.limitations.join(' ')).toContain('원국 계산을 완료하지 못했습니다');
  });

  it('throws a clear error only when essential self or partner input is missing', () => {
    expect(() => buildMatchCoupleReportModel({
      ...fixture(),
      birthDate: ''
    })).toThrow(/본인의 생년월일/);
    expect(() => buildMatchCoupleReportModel({
      ...fixture(),
      partner: undefined
    })).toThrow(/상대방 출생정보/);
  });
});

describe('match-couple relation grouping', () => {
  it('groups 합·충·형·파·해 independently and preserves overlapping evidence', () => {
    const grouped = groupMatchCoupleRelations([
      relation('six-combination', 'same-pair-combine'),
      relation('punishment', 'same-pair-punishment'),
      relation('break', 'same-pair-break'),
      relation('clash', 'pair-clash'),
      relation('harm', 'pair-harm'),
      relation('resentment', 'supplemental-resentment')
    ]);

    expect(grouped.map((group) => group.label)).toEqual(['합', '충', '형', '파', '해']);
    expect(grouped.find((group) => group.id === 'combine')?.items.map((item) => item.id))
      .toEqual(['same-pair-combine']);
    expect(grouped.find((group) => group.id === 'punishment')?.items.map((item) => item.id))
      .toEqual(['same-pair-punishment']);
    expect(grouped.find((group) => group.id === 'break')?.items.map((item) => item.id))
      .toEqual(['same-pair-break']);
    expect(grouped.find((group) => group.id === 'clash')?.items.map((item) => item.id))
      .toEqual(['pair-clash']);
    expect(grouped.find((group) => group.id === 'harm')?.items.map((item) => item.id))
      .toEqual(['pair-harm']);
    expect(grouped.flatMap((group) => group.items).some((item) => item.id === 'supplemental-resentment'))
      .toBe(false);
    expect(grouped.flatMap((group) => group.items).every((item) => item.evidenceIds[0] === item.id))
      .toBe(true);
  });
});
