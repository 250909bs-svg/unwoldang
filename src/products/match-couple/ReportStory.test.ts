import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it } from 'vitest';
import { buildMatchCoupleReportModel } from './analysis';
import MatchCoupleStoryReport from './ReportStory';
import { MATCH_COUPLE_CONTEXT_VERSION, type MatchCoupleStoredFormData } from './types';

const SEOUL = {
  label: '서울',
  latitude: 37.5665,
  longitude: 126.978,
  timezone: 'Asia/Seoul',
  utcOffsetMinutes: 540,
  applySolarTimeCorrection: true
} as const;

function fixture(): Partial<MatchCoupleStoredFormData> {
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
    q1: '대화 기준을 어떻게 정할까요?',
    q2: '오래 가기 위해 무엇을 바꿀까요?',
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
      birthLocation: SEOUL
    },
    matchCoupleContext: {
      version: MATCH_COUPLE_CONTEXT_VERSION,
      relationshipStatus: 'dating',
      relationshipDuration: 'under3',
      majorConflict: '연락 템포가 다를 때 서로의 의도를 단정합니다.',
      desiredInsight: '둘이 합의할 대화와 생활 규칙을 알고 싶습니다.',
      questions: ['대화 기준을 어떻게 정할까요?', '오래 가기 위해 무엇을 바꿀까요?'],
      selfLocationUnknown: false,
      partnerLocationUnknown: false,
      selfSolarTimeCorrectionRequested: true,
      partnerSolarTimeCorrectionRequested: true
    }
  };
}

describe('match-couple paid webtoon report', () => {
  it('renders the fixed cover, docket, direct answers, 13 chapters, evidence, and experiment', () => {
    const model = buildMatchCoupleReportModel(fixture());
    const report = createElement(MatchCoupleStoryReport, {
      model,
      answers: [],
      createdAt: '2026-07-22T12:00:00.000Z',
      storageKey: 'test-report',
      shareMessage: '',
      onShare: () => undefined
    });
    const html = renderToStaticMarkup(createElement(StaticRouter, { location: '/report/match-couple' }, report));

    expect(html).toContain('PRIVATE MATCH CONSULTATION');
    expect(html).toContain('두 사람의 관계 접수서');
    expect(html).toContain('결론부터 보는 9개 직답');
    expect(html.match(/id="match-couple-chapter-\d+"/gu)).toHaveLength(13);
    expect(html).toContain('왜 이렇게 읽었는지');
    expect(html).toContain('CHAPTER 02 · 합충형파해');
    expect(html).toContain('조심할 말과 행동');
    expect(html).toContain('질문 두 개');
    expect(html).toContain('30 DAY RELATIONSHIP LAB');
    expect(html).toContain('couple-daily.avif');
    expect(html).toContain('점수가 아닌 정성 근거');
    expect(html).not.toContain('궁합 성공 확률');
  });
});
