import { describe, expect, it } from 'vitest';
import type { IntakeFormData } from '../../api/mockData';
import {
  REUNION_CONTEXT_VERSION,
  type ReunionContext
} from '../../lib/reunion';
import type { SajuReportData } from '../../lib/saju/report';
import { getReunionImage, reunionImages } from './assets';
import { getReunionDraftStorageKey } from './intakeStorage';
import { buildReunionActionGuide, buildReunionReportPresentation } from './reportPresentation';
import {
  REUNION_PATHS,
  REUNION_PRICE,
  buildReunionCheckoutState,
  createEmptyReunionDraft,
  createReunionFormData,
  getReunionRouteContext
} from './reunionFlow';

const context: ReunionContext = {
  schemaVersion: REUNION_CONTEXT_VERSION,
  breakupDuration: 'oneTo3m',
  contactStatus: 'no-contact',
  lastContactAt: '2026-08-01',
  breakupReason: '대화 방식의 차이로 합의하고 헤어졌어요.',
  desiredOutcome: 'clarity',
  notes: '돌려받을 물건이 있어요.',
  consentToUsePartnerData: true
};

const formData: IntakeFormData = {
  name: '지윤',
  gender: 'female',
  calendar: 'solar',
  isLeapMonth: false,
  birthDate: '1994-03-12',
  birthTime: '10:20',
  isUnknownTime: false,
  birthTimePrecision: 'exact',
  dayBoundaryPolicy: 'midnight',
  partner: {
    name: '민수',
    gender: 'male',
    calendar: 'solar',
    isLeapMonth: false,
    birthDate: '1992-10-08',
    birthTime: '',
    isUnknownTime: true,
    birthTimePrecision: 'unknown',
    dayBoundaryPolicy: 'midnight'
  },
  relationshipStatus: 'breakup-reunion',
  relationshipDuration: '',
  location: '',
  q1: '먼저 안부를 물어도 될까요?',
  q2: '이별 후 기간: 1~3개월 · 현재 연락: 현재 연락하지 않아요'
};

const report = {
  customerName: '지윤',
  dayMaster: '갑',
  dayMasterElement: '목',
  helpfulElements: ['수'],
  fiveElements: [
    { label: '목', value: 2, color: '#000' },
    { label: '화', value: 1, color: '#000' }
  ],
  currentDayun: { name: '갑자 대운', range: '2024~2033', summary: '', focus: '', caution: '' },
  monthLuck: [{ year: 2026, month: 10, ganzhi: '갑자', score: 8, summary: '', focus: '', warning: '' }],
  sections: [
    {
      id: 'temporal-evidence-v2',
      title: '시기 근거',
      paragraphs: ['대화의 속도를 조절하는 흐름으로 읽습니다.']
    }
  ],
  birthLabel: '1994년 3월 12일',
  serialNumber: 'UW-REUNION-001'
} as unknown as SajuReportData;

describe('reunion frontend contract', () => {
  it('maps every editorial image to responsive WebP assets', () => {
    expect(Object.keys(reunionImages)).toEqual(['hero', 'reflection', 'contact', 'reunion', 'moveOn']);
    expect(getReunionImage('hero')).toEqual({
      src: '/assets/reunion/hero-960.webp',
      srcSet: '/assets/reunion/hero-640.webp 640w, /assets/reunion/hero-960.webp 960w',
      sizes: '(max-width: 680px) 100vw, 960px'
    });
    expect(getReunionImage('moveOn').src).toBe('/assets/reunion/move-on-960.webp');
  });

  it('uses the 990 won offer and dedicated route contract', () => {
    expect(REUNION_PRICE).toBe(990);
    expect(REUNION_PATHS).toEqual({
      detail: '/detail/love-reunion',
      intake: '/form/love-reunion',
      preview: '/preview/love-reunion',
      checkout: '/checkout',
      loading: '/loading',
      report: '/report/love-reunion'
    });
  });

  it('builds the two-person IntakeFormData without inventing birth times', () => {
    const draft = createEmptyReunionDraft();
    draft.self = {
      name: ' 지윤 ',
      gender: 'female',
      calendar: 'solar',
      isLeapMonth: false,
      birthDate: '1994-03-12',
      birthTime: '10:20',
      isUnknownTime: false
    };
    draft.partner = {
      name: ' 민수 ',
      gender: 'male',
      calendar: 'lunar',
      isLeapMonth: true,
      birthDate: '1992-09-13',
      birthTime: '',
      isUnknownTime: true
    };
    draft.breakupDuration = 'oneTo3m';
    draft.contactStatus = 'no-contact';
    draft.question = '먼저 안부를 물어도 될까요?';

    const result = createReunionFormData(draft);
    expect(result.name).toBe('지윤');
    expect(result.partner).toMatchObject({
      name: '민수',
      calendar: 'lunar',
      isLeapMonth: true,
      birthTime: '',
      isUnknownTime: true,
      birthTimePrecision: 'unknown'
    });
    expect(result.relationshipStatus).toBe('breakup-reunion');
    expect(result.q2).toContain('1~3개월');
  });

  it('round-trips reunion context inside checkout formData', () => {
    const state = buildReunionCheckoutState(formData, context, 'owner-1', '/detail/love-reunion');
    expect(state.product).toBe('love-reunion');
    expect(state.formData.reunionContext).toEqual(context);
    expect(state.reunionContext).toEqual(context);
    expect(state.draftOwnerId).toBe('owner-1');
  });

  it('restores nested context when checkout back state omits the top-level mirror', () => {
    expect(getReunionRouteContext({ formData: { ...formData, reunionContext: context } })).toEqual(context);
  });

  it('namespaces session drafts without exposing the raw owner id', () => {
    expect(getReunionDraftStorageKey()).toContain('.guest');
    expect(getReunionDraftStorageKey('kakao/user:123')).not.toContain('/');
    expect(getReunionDraftStorageKey('kakao/user:123')).toContain('kakaouser123');
  });

  it('withholds contact guidance when the other person has blocked contact', () => {
    const guide = buildReunionActionGuide({ ...context, contactStatus: 'blocked' });
    expect(guide.contact.status).toBe('withheld');
    expect(guide.contact.prohibitedActions.join(' ')).toContain('우회 연락');
    expect(guide.today.join(' ')).toContain('연락 수단');
  });

  it('keeps calculated evidence separate from user-provided context', () => {
    const presentation = buildReunionReportPresentation(report, formData, context);
    expect(presentation.viewModel.deterministicEvidence[0]).toMatchObject({
      source: 'saju',
      statement: '대화의 속도를 조절하는 흐름으로 읽습니다.'
    });
    expect(presentation.viewModel.userContext).toContainEqual(expect.objectContaining({
      id: 'breakupReason',
      source: 'user-provided',
      verification: 'unverified'
    }));
    expect(presentation.viewModel.deterministicEvidence.map((item) => item.statement).join(' '))
      .not.toContain(context.breakupReason);
  });

  it('uses month luck only as a non-guaranteed reference window', () => {
    const presentation = buildReunionReportPresentation(report, formData, context);
    expect(presentation.timingReference.label).toBe('2026년 10월 · 갑자');
    expect(presentation.timingReference.note).toContain('보장하는 날짜가 아닙니다');
  });
});
