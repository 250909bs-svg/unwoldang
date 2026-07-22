import { describe, expect, it, vi } from 'vitest';
import {
  MATCH_COUPLE_STORY_ARTWORK_KEYS,
  MATCH_COUPLE_STORY_CHAPTER_IDS,
  buildMatchCoupleStoryChapters
} from './story';
import {
  MATCH_COUPLE_CONTEXT_VERSION,
  type MatchCoupleGuidanceItem,
  type MatchCoupleReportModel
} from './types';

function guidance(
  id: string,
  label: string,
  tendency: MatchCoupleGuidanceItem['tendency']
): MatchCoupleGuidanceItem {
  return {
    id,
    label,
    tendency,
    statement: `${id}-고유-해석`,
    practicalRule: `${id}-고유-실천`,
    evidenceIds: [`${id}-근거`],
    uncertainty: [`${id}-유보`]
  };
}

function fixture(): MatchCoupleReportModel {
  return {
    version: 'match-couple-report-v1',
    names: ['하늘', '바다'],
    relationshipSummary: '연애 3년 미만인 두 사람',
    context: {
      version: MATCH_COUPLE_CONTEXT_VERSION,
      relationshipStatus: 'dating',
      relationshipDuration: 'under3',
      majorConflict: '갈등-고유-맥락',
      desiredInsight: '통찰-고유-맥락',
      questions: ['첫째-고유-질문', '둘째-고유-질문'],
      selfLocationUnknown: false,
      partnerLocationUnknown: false,
      selfSolarTimeCorrectionRequested: true,
      partnerSolarTimeCorrectionRequested: true
    },
    people: [
      {
        id: 'self',
        name: '하늘',
        dayMaster: '갑-고유',
        dayMasterElement: '목',
        pillars: { year: '갑자-고유', month: '을축-고유', day: '병인-고유', hour: null },
        fiveElements: [
          { label: '목', weight: 11 },
          { label: '화', weight: 12 },
          { label: '토', weight: 13 },
          { label: '금', weight: 14 },
          { label: '수', weight: 15 }
        ],
        tenGods: [{ label: '비견-고유', weight: 21 }],
        spousePalace: { branch: '인-고유', element: '목', tenGod: '편재-고유' },
        availability: { status: 'limited', note: '하늘-시간-유보' }
      },
      {
        id: 'partner',
        name: '바다',
        dayMaster: '경-고유',
        dayMasterElement: '금',
        pillars: { year: '정묘-고유', month: '무진-고유', day: '기사-고유', hour: '경오-고유' },
        fiveElements: [
          { label: '목', weight: 31 },
          { label: '화', weight: 32 },
          { label: '토', weight: 33 },
          { label: '금', weight: 34 },
          { label: '수', weight: 35 }
        ],
        tenGods: [{ label: '정관-고유', weight: 41 }],
        spousePalace: { branch: '사-고유', element: '화', tenGod: '정관-배우자궁-고유' },
        availability: { status: 'available' }
      }
    ],
    overview: {
      id: 'overview-고유',
      label: '관계-개요-고유',
      tendency: 'conditional',
      statement: '관계-개요-고유-해석',
      evidenceIds: ['관계-개요-근거'],
      uncertainty: ['관계-개요-유보']
    },
    relations: [
      {
        id: 'combine',
        label: '합',
        items: [{
          id: '합-고유-id',
          name: '합-고유-이름',
          subtype: '합-고유-세부',
          description: '합-고유-설명',
          evidenceIds: ['합-고유-근거'],
          uncertainty: ['합-고유-유보']
        }]
      },
      { id: 'clash', label: '충', items: [] },
      { id: 'punishment', label: '형', items: [] },
      { id: 'break', label: '파', items: [] },
      { id: 'harm', label: '해', items: [] }
    ],
    guidance: {
      attraction: guidance('끌림', '끌림-고유-라벨', 'supportive'),
      emotionalExpression: guidance('감정표현', '감정표현-고유-라벨', 'conditional'),
      communication: guidance('연락대화', '연락대화-고유-라벨', 'tension'),
      conflictRecovery: guidance('갈등회복', '갈등회복-고유-라벨', 'conditional'),
      dailyLife: guidance('생활습관', '생활습관-고유-라벨', 'supportive'),
      money: guidance('소비재물', '소비재물-고유-라벨', 'conditional'),
      longTermRoles: guidance('장기역할', '장기역할-고유-라벨', 'insufficient')
    },
    cautionWords: ['금지-고유-말-하나', '금지-고유-말-둘'],
    cautionActions: ['금지-고유-행동-하나', '금지-고유-행동-둘'],
    relationshipRules: ['유지-고유-규칙-하나', '유지-고유-규칙-둘'],
    experiment: [
      {
        days: '1~7일-고유',
        title: '실험-고유-제목-하나',
        action: '실험-고유-행동-하나',
        check: '실험-고유-확인-하나'
      },
      {
        days: '8~30일-고유',
        title: '실험-고유-제목-둘',
        action: '실험-고유-행동-둘',
        check: '실험-고유-확인-둘'
      }
    ],
    questions: ['첫째-고유-질문', '둘째-고유-질문'],
    limitations: ['전체-고유-유보'],
    evidenceIds: ['person:self:day-master', 'person:partner:day-master', '전체-고유-근거'],
    generatedFrom: { calendarEngine: 'calendar-test', compatibilityEngine: '2.0.0' }
  };
}

function objectKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(objectKeys);
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, item]) => [key, ...objectKeys(item)]);
}

describe('match-couple story chapters', () => {
  it('keeps the exact 13-scene MZ webtoon order and complete chapter contract', () => {
    const chapters = buildMatchCoupleStoryChapters(fixture());

    expect(chapters).toHaveLength(13);
    expect(chapters.map((chapter) => chapter.id)).toEqual(MATCH_COUPLE_STORY_CHAPTER_IDS);
    expect(chapters.map((chapter) => chapter.order)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13
    ]);
    expect(chapters.map((chapter) => chapter.artworkKey)).toEqual(MATCH_COUPLE_STORY_ARTWORK_KEYS);

    for (const chapter of chapters) {
      expect(Object.keys(chapter).sort()).toEqual([
        'artworkKey',
        'evidenceIds',
        'eyebrow',
        'factBomb',
        'id',
        'order',
        'practicalRule',
        'statement',
        'title',
        'uncertainty'
      ]);
      expect(chapter.eyebrow).toContain(String(chapter.order).padStart(2, '0'));
      expect(chapter.title).not.toBe('');
      expect(chapter.factBomb).not.toBe('');
      expect(chapter.statement).not.toBe('');
      expect(chapter.practicalRule).not.toBe('');
    }
  });

  it('consumes every required report section without replacing the existing model', () => {
    const model = fixture();
    const rendered = JSON.stringify(buildMatchCoupleStoryChapters(model));
    const requiredSourceValues = [
      model.relationshipSummary,
      model.people[0]?.dayMaster,
      model.people[0]?.pillars.year,
      model.people[0]?.tenGods[0]?.label,
      model.people[0]?.spousePalace.tenGod,
      model.people[1]?.dayMaster,
      model.people[1]?.pillars.hour,
      model.people[1]?.tenGods[0]?.label,
      model.people[1]?.spousePalace.tenGod,
      model.overview?.statement,
      ...model.relations.flatMap((group) => [
        group.label,
        ...group.items.flatMap((item) => [item.subtype, item.description, ...item.evidenceIds, ...item.uncertainty])
      ]),
      ...Object.values(model.guidance || {}).flatMap((item) => [
        item.statement,
        item.practicalRule,
        ...item.evidenceIds,
        ...item.uncertainty
      ]),
      ...model.cautionWords,
      ...model.cautionActions,
      ...model.relationshipRules,
      ...model.questions,
      model.context.majorConflict,
      model.context.desiredInsight,
      ...model.experiment.flatMap((item) => [item.days, item.title, item.action, item.check]),
      ...model.limitations
    ].filter((value): value is string => Boolean(value));

    for (const value of requiredSourceValues) {
      expect(rendered, value).toContain(value);
    }
  });

  it('is deterministic, never calls a random generator, and exposes no score field', () => {
    const model = fixture();
    const random = vi.spyOn(Math, 'random');

    const first = buildMatchCoupleStoryChapters(model);
    const second = buildMatchCoupleStoryChapters(model);

    expect(second).toEqual(first);
    expect(random).not.toHaveBeenCalled();
    expect(objectKeys(first).some((key) => key.toLowerCase() === 'score')).toBe(false);
    expect(JSON.stringify(first)).not.toContain('"score"');
    random.mockRestore();
  });

  it('keeps all 13 scenes but explicitly withholds unavailable and unknown-time analysis', () => {
    const unavailable: MatchCoupleReportModel = {
      ...fixture(),
      people: [null, fixture().people[1]],
      overview: null,
      relations: fixture().relations.map((group) => ({ ...group, items: [] })),
      guidance: null,
      limitations: ['하늘: 출생시간 미상으로 일주가 달라져 결론을 유보했습니다.'],
      evidenceIds: ['person:partner:day-master'],
      generatedFrom: { calendarEngine: 'calendar-test', compatibilityEngine: null }
    };
    const chapters = buildMatchCoupleStoryChapters(unavailable);

    expect(chapters).toHaveLength(13);
    expect(chapters[0].statement).toContain('원국 해석을 유보');
    expect(chapters[0].uncertainty.join(' ')).toContain('출생시간 미상');
    for (const chapter of chapters.slice(2, 9)) {
      expect(chapter.statement).toContain('해석을 유보');
      expect(chapter.evidenceIds).toEqual([]);
    }

    const empty = buildMatchCoupleStoryChapters(null);
    expect(empty).toHaveLength(13);
    expect(empty.every((chapter) => chapter.uncertainty.length > 0)).toBe(true);
    expect(empty.slice(2, 9).every((chapter) => chapter.statement.includes('유보'))).toBe(true);
  });
});
