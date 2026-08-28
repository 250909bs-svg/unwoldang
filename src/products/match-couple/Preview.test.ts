import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  MATCH_COUPLE_GUEST_DRAFT_RETURN_TO,
  MatchCouplePreviewStory,
  buildMatchCouplePreview,
  getMatchCouplePreviewNextPath,
  isMatchCoupleGuestDraftReturn
} from './Preview';
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
    birthTime: '',
    isUnknownTime: true,
    birthTimePrecision: 'unknown',
    dayBoundaryPolicy: 'midnight',
    birthLocation: SEOUL,
    location: '서울',
    relationshipStatus: 'dating',
    relationshipDuration: 'under3',
    q1: '서버 전달용 질문 1',
    q2: '서버 전달용 질문 2',
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
      majorConflict: '연락이 늦으면 서로의 마음을 단정하는 민감한 갈등 원문',
      desiredInsight: '결혼 가능성을 단정적으로 알고 싶은 민감한 원문',
      questions: [
        '첫 번째 비공개 질문 원문은 무엇인가요?',
        '두 번째 비공개 질문 원문은 무엇인가요?'
      ],
      selfLocationUnknown: false,
      partnerLocationUnknown: false,
      selfSolarTimeCorrectionRequested: false,
      partnerSolarTimeCorrectionRequested: false
    }
  };
}

describe('match-couple free webtoon preview', () => {
  it('renders only the bounded teaser and locked chapter titles', () => {
    const result = buildMatchCouplePreview(fixture());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const html = renderToStaticMarkup(createElement(MatchCouplePreviewStory, {
      teaser: result.teaser,
      onEdit: () => undefined,
      onContinue: () => undefined
    }));

    expect(html).toContain('하늘');
    expect(html).toContain('바다');
    expect(html).toContain('시주 미상');
    expect(html).toContain('합·충·형·파·해');
    expect(html).toContain('질문 2개 맞춤 답변');
    expect(html).toContain('30일 관계 실험');
    expect(html).toContain('couple-cover.avif');
    expect(html).toContain('couple-friction.webp');
    expect(html).toContain('couple-ritual.avif');
    expect(html).toContain('loading="lazy"');
    expect(html.match(/width="941"/g)).toHaveLength(3);
    expect(html.match(/height="1672"/g)).toHaveLength(3);
    expect(html.match(/fetchpriority="high"/g)).toHaveLength(1);
    expect(html).not.toContain('fetchPriority');

    expect(html).not.toContain('민감한 갈등 원문');
    expect(html).not.toContain('민감한 원문');
    expect(html).not.toContain('첫 번째 비공개 질문');
    expect(html).not.toContain('두 번째 비공개 질문');
    expect(html).not.toContain(result.formData.matchCoupleContext.questions[0]);
  });

  it('does not put the locked guidance details into the teaser model', () => {
    const result = buildMatchCouplePreview(fixture());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const teaserJson = JSON.stringify(result.teaser);
    expect(teaserJson).not.toContain('majorConflict');
    expect(teaserJson).not.toContain('desiredInsight');
    expect(teaserJson).not.toContain('questions');
    expect(teaserJson).not.toContain('practicalRule');
    expect(teaserJson).not.toContain('experiment');
    expect(teaserJson).not.toContain('cautionWords');
    expect(teaserJson).not.toContain('relationshipRules');
  });

  it('selects login, loading, and checkout in that order', () => {
    expect(getMatchCouplePreviewNextPath(false, false)).toBe('/login');
    expect(getMatchCouplePreviewNextPath(false, true)).toBe('/login');
    expect(getMatchCouplePreviewNextPath(true, true)).toBe('/loading');
    expect(getMatchCouplePreviewNextPath(true, false)).toBe('/checkout');
  });

  it('uses a non-PII guest marker only for the login-return preview', () => {
    expect(MATCH_COUPLE_GUEST_DRAFT_RETURN_TO).toBe('/preview/match-couple?draft=guest');
    expect(isMatchCoupleGuestDraftReturn('?draft=guest')).toBe(true);
    expect(isMatchCoupleGuestDraftReturn('?draft=guest&from=login')).toBe(true);
    expect(isMatchCoupleGuestDraftReturn('')).toBe(false);
    expect(isMatchCoupleGuestDraftReturn('?draft=member')).toBe(false);
    expect(MATCH_COUPLE_GUEST_DRAFT_RETURN_TO).not.toContain('birth');
  });
});
