import { describe, expect, it } from 'vitest';
import type { IntakeFormData } from '../../api/mockData';
import {
  REUNION_CONTEXT_VERSION,
  allowReunionPurchaseCta,
  buildReunionGate,
  buildReunionReportPayload,
  type ReunionContext
} from '../../lib/reunion';
import type { SajuReportData } from '../../lib/saju/report';
import { getReunionImage, reunionImages } from './assets';
import { getReunionDraftStorageKey } from './intakeStorage';
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

  /* ── 안전 계약: 화면이 실제로 타는 경로에서 검사한다 ─────────
     `buildReunionReportPresentation` / `buildReunionActionGuide` 는 뷰 재작성 뒤
     프로덕션 소비자가 0개다. 그쪽만 검사하면 세 보증이 **사용자가 도달할 수 없는 코드** 위에서
     green 으로 남는다. 아래 세 건은 전부 `buildReunionGate` / `buildReunionReportPayload`
     — 즉 `/report/love-reunion` 이 실제로 부르는 함수 — 를 겨눈다. */

  it('withholds contact guidance and the purchase CTA when the other person has blocked contact', () => {
    const blocked: ReunionContext = { ...context, contactStatus: 'blocked' };
    const gate = buildReunionGate({ context: blocked });

    expect(gate.state).toBe('deferred');
    expect(allowReunionPurchaseCta(gate)).toBe(false);

    const payload = buildReunionReportPayload({
      report,
      context: blocked,
      name: '지윤',
      birthDate: formData.birthDate
    });
    const prohibited = payload.chapters
      .flatMap((chapter) => chapter.cuts)
      .find((cut) => cut.payload?.kind === 'prohibited');
    const items = prohibited?.payload?.kind === 'prohibited' ? prohibited.payload.items : [];

    expect(items.join(' ')).toContain('우회 연락');
    expect(payload.allowPurchaseCta).toBe(false);

    // 이 판정은 어떤 명리 근거로도 뒤집히지 않는다.
    const readiness = payload.chapters
      .flatMap((chapter) => chapter.cuts)
      .find((cut) => cut.payload?.kind === 'readiness');
    expect(readiness?.payload?.kind === 'readiness' ? readiness.payload.readiness.withheld : false).toBe(true);
  });

  it('keeps calculated conditions separate from user-provided context', () => {
    const payload = buildReunionReportPayload({
      report,
      context,
      name: '지윤',
      birthDate: formData.birthDate
    });
    const readinessCut = payload.chapters
      .flatMap((chapter) => chapter.cuts)
      .find((cut) => cut.payload?.kind === 'readiness');
    const readiness =
      readinessCut?.payload?.kind === 'readiness' ? readinessCut.payload.readiness : null;

    expect(readiness).toBeTruthy();
    // 다섯 칸 모두 출처가 붙어 있고, 두 종류가 다 존재한다.
    expect(readiness?.items.every((item) => item.basis === 'input' || item.basis === 'calculated')).toBe(true);
    expect(readiness?.items.some((item) => item.basis === 'calculated')).toBe(true);
    expect(readiness?.items.some((item) => item.basis === 'input')).toBe(true);

    // 독자가 쓴 이별 사유가 계산 칸의 문장으로 흘러들지 않는다.
    const calculated = (readiness?.items || [])
      .filter((item) => item.basis === 'calculated')
      .map((item) => `${item.label} ${item.reason}`)
      .join(' ');
    expect(calculated).not.toContain(context.breakupReason);
  });

  it('uses month luck only as a non-guaranteed reference window', () => {
    const payload = buildReunionReportPayload({
      report,
      context,
      name: '지윤',
      birthDate: formData.birthDate
    });
    const chart = payload.chapters
      .flatMap((chapter) => chapter.cuts)
      .find((cut) => cut.payload?.kind === 'timeline12');

    // 삭제 불가 캡션이 차트에 붙어 있고, 축 라벨에 '재회'·'연락'이 없다.
    expect(chart?.undeletableCopyId).toBe('timeline-not-probability');
    expect(chart?.caption).toContain('상대의 행동을 예측한 값이 아니에요');
    const cells = chart?.payload?.kind === 'timeline12' ? chart.payload.cells : [];
    expect(JSON.stringify(cells.map((cell) => cell.conditions))).not.toContain('재회');

    // 날짜를 약속하는 표가 아니라는 선언도 같은 장에 남아 있다.
    const promise = payload.chapters
      .flatMap((chapter) => chapter.cuts)
      .find((cut) => cut.undeletableCopyId === 'timeline-not-promise');
    expect(promise?.mask).toBe('none');
  });
});
