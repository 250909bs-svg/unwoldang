import { createEmptyReunionIntake } from './intake';
import type { ReunionIntakeData } from './types';

export function createReunionSampleInput(): ReunionIntakeData {
  const input = createEmptyReunionIntake('2026-07-21');
  return {
    ...input,
    name: '서윤',
    gender: 'female',
    birthDate: '1994-03-12',
    birthTime: '10:30',
    relationshipStatus: 'breakup-reunion',
    relationshipDuration: 'under5',
    location: '서울',
    q1: 'reunion-index',
    q2: 'recurrence-risk',
    partner: {
      name: '민준',
      gender: 'male',
      calendar: 'solar',
      isLeapMonth: false,
      birthDate: '1992-11-04',
      birthTime: '18:20',
      isUnknownTime: false,
      birthTimePrecision: 'exact',
      dayBoundaryPolicy: 'midnight'
    },
    reunion: {
      ...input.reunion,
      adultConfirmed: true,
      dataUseConsent: true,
      dataAuthorityConfirmed: true,
      selfBirthAccuracy: 'documented',
      partnerBirthAccuracy: 'remembered',
      partnerBirthKnown: true,
      selectedQuestions: ['reunion-index', 'recurrence-risk', 'contact-timing'],
      desiredOutcome: 'conversation',
      messageDraft: '오랜만이야. 갑자기 연락해서 미안해. 잘 지내는지 궁금했어.',
      facts: {
        ...input.reunion.facts,
        relationshipStartDate: '2022-02-14',
        breakupDate: '2026-04-08',
        relationshipLengthMonths: 50,
        daysSinceBreakup: 104,
        breakupInitiator: 'mutual',
        breakupReasons: ['communication', 'work'],
        breakupReasonDetail: '바쁜 시기에 대화가 줄고 오해를 풀지 못했습니다.',
        pastReunionCount: 0,
        repeatedCause: false,
        lastContactDate: '2026-06-28',
        daysSinceLastContact: 23,
        lastContactMood: 'neutral',
        contactFrequency: 'rare',
        blockState: 'none',
        newRelationship: 'none',
        distance: 'same-area',
        workObstacle: true
      },
      readiness: {
        accountabilityTaken: true,
        breakupCauseChanged: true,
        canAcceptNoReply: true,
        canRespectBoundary: true,
        supportAvailable: true,
        level: 'ready'
      }
    }
  };
}
