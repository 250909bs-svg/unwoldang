import { describe, expect, it } from 'vitest';
import { buildAnalysisRequestPayload } from './analysisPayload';
import {
  LOVE_REUNION_CONTEXT_VERSION,
  LOVE_REUNION_TEXT_LIMITS
} from '../products/love-reunion/contract';

describe('analysis request payload', () => {
  it('keeps the canonical love micro choice and every expanded relationship branch', () => {
    const expectedLabels = {
      situationship: '썸 타는 중',
      ambiguous: '관계가 애매함',
      'breakup-reunion': '이별·재회 고민'
    } as const;

    Object.entries(expectedLabels).forEach(([relationshipStatus, expectedLabel]) => {
      const payload = buildAnalysisRequestPayload('love-reading', {
        relationshipStatus: relationshipStatus as keyof typeof expectedLabels,
        relationshipDuration: '',
        loveReaction: 'D',
        loveFocus: 'repeated-pattern'
      });

      expect(payload.relationship).toMatchObject({
        status: relationshipStatus,
        duration: null,
        microChoice: 'D',
        focus: 'repeated-pattern',
        summary: expectedLabel
      });
    });
  });

  it('normalizes primary and partner birth policies before sending to the server', () => {
    const payload = buildAnalysisRequestPayload('match-couple', {
      name: '  본인  ',
      gender: 'female',
      calendar: 'solar',
      isLeapMonth: false,
      birthDate: '1992-09-09',
      birthTime: '10:24',
      isUnknownTime: false,
      birthLocation: {
        label: '서울',
        timezone: 'Asia/Seoul',
        utcOffsetMinutes: 540
      },
      relationshipStatus: '',
      relationshipDuration: '',
      q1: '  관계에서 무엇을 맞춰야 하나요?  ',
      q2: '',
      partner: {
        name: '  상대  ',
        gender: 'male',
        calendar: 'solar',
        isLeapMonth: false,
        birthDate: '1989-04-12',
        birthTime: '08:15',
        isUnknownTime: true
      }
    });

    expect(payload.timezone).toBe('Asia/Seoul');
    expect(payload.birth.precision).toBe('exact');
    expect(payload.birth.dayBoundaryPolicy).toBe('midnight');
    expect(payload.partner).toMatchObject({
      name: '상대',
      birthTime: '',
      birthTimePrecision: 'unknown',
      dayBoundaryPolicy: 'midnight'
    });
    expect(payload.pastLifeContext).toBeNull();
    expect(payload.questions).toEqual(['관계에서 무엇을 맞춰야 하나요?']);
  });

  it('preserves structured past-life context independently from generated questions', () => {
    const payload = buildAnalysisRequestPayload('past-life-goblin', {
      name: '전생 고객',
      gender: 'female',
      calendar: 'solar',
      isLeapMonth: false,
      birthDate: '1994-03-21',
      birthTime: '09:30',
      isUnknownTime: false,
      relationshipStatus: '',
      relationshipDuration: '',
      q1: '전생 질문 1',
      q2: '전생 질문 2',
      pastLifeTopic: '  연애  ',
      repeatedScene: '  늘 제가 먼저 관계를 수습해요.  ',
      frequentEmotion: '  억울함  ',
      hiddenDesire: '  책임에서 잠시 벗어나고 싶어요.  ',
      chosenSymbol: '  붉은 실  ',
      readingTone: '  균형 있게  '
    });

    expect(payload.pastLifeContext).toEqual({
      topic: '연애',
      repeatedScene: '늘 제가 먼저 관계를 수습해요.',
      frequentEmotion: '억울함',
      hiddenDesire: '책임에서 잠시 벗어나고 싶어요.',
      chosenSymbol: '붉은 실',
      readingTone: '균형 있게'
    });
    expect(payload.questions).toEqual(['전생 질문 1', '전생 질문 2']);
  });

  it('serializes a bounded love-reunion v2 context and permitted partner data', () => {
    const payload = buildAnalysisRequestPayload('love-reunion', {
      partner: {
        name: '  상대  ',
        gender: 'male',
        calendar: 'solar',
        isLeapMonth: false,
        birthDate: '1991-02-03',
        birthTime: '14:20',
        isUnknownTime: false
      },
      reunionContext: {
        version: 1,
        relationshipState: 'separated-contacting',
        relationshipLength: '1-to-3-years',
        breakupElapsed: '1-to-3-months',
        lastContactTiming: 'under-1-month',
        lastContactNote: `  ${'가'.repeat(280)}  `,
        currentContact: 'occasional',
        contactBoundary: 'none',
        breakupReason: 'other',
        breakupReasonDetail: '나'.repeat(360),
        reunionReason: '다'.repeat(380),
        partnerBirthKnown: true,
        partnerDataPermissionConfirmed: true
      }
    });

    expect(payload.reunionContext).toMatchObject({
      version: LOVE_REUNION_CONTEXT_VERSION,
      relationshipState: 'separated-contacting',
      relationshipLength: '1-to-3-years',
      breakupElapsed: '1-to-3-months',
      lastContactTiming: 'under-1-month',
      currentContact: 'occasional',
      contactBoundary: 'none',
      breakupReason: 'other',
      partnerBirthKnown: true,
      partnerDataPermissionConfirmed: true
    });
    expect(payload.reunionContext?.lastContactNote).toHaveLength(
      LOVE_REUNION_TEXT_LIMITS.lastContactNote
    );
    expect(payload.reunionContext?.breakupReasonDetail).toHaveLength(
      LOVE_REUNION_TEXT_LIMITS.breakupReasonDetail
    );
    expect(payload.reunionContext?.reunionReason).toHaveLength(
      LOVE_REUNION_TEXT_LIMITS.reunionReason
    );
    expect(payload.partner).toMatchObject({
      name: '상대',
      birthDate: '1991-02-03',
      birthTime: '14:20'
    });
  });

  it('does not transmit partner birth data without explicit use permission', () => {
    const payload = buildAnalysisRequestPayload('love-reunion', {
      partner: {
        name: '상대',
        gender: 'male',
        calendar: 'solar',
        isLeapMonth: false,
        birthDate: '1991-02-03',
        birthTime: '',
        isUnknownTime: true
      },
      reunionContext: {
        contactBoundary: 'none',
        partnerBirthKnown: true,
        partnerDataPermissionConfirmed: false
      }
    });

    expect(payload.partner).toBeNull();
    expect(payload.reunionContext).toMatchObject({
      version: LOVE_REUNION_CONTEXT_VERSION,
      contactBoundary: 'none',
      partnerBirthKnown: true,
      partnerDataPermissionConfirmed: false
    });
  });
});
