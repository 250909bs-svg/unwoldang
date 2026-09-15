import type { IntakeFormData } from '../../api/mockData';
import type { ReunionContext } from '../../lib/reunion';

export const REUNION_PRODUCT_ID = 'love-reunion' as const;
export const REUNION_PRICE = 990;
export const REUNION_PATHS = Object.freeze({
  detail: '/detail/love-reunion',
  intake: '/form/love-reunion',
  preview: '/preview/love-reunion',
  checkout: '/checkout',
  loading: '/loading',
  report: '/report/love-reunion'
});

export type ReunionPersonDraft = {
  name: string;
  gender: IntakeFormData['gender'];
  calendar: IntakeFormData['calendar'];
  isLeapMonth: boolean;
  birthDate: string;
  birthTime: string;
  isUnknownTime: boolean;
};

export type ReunionIntakeDraft = {
  self: ReunionPersonDraft;
  partner: ReunionPersonDraft;
  breakupDuration: ReunionContext['breakupDuration'];
  lastContactAt: string;
  contactStatus: ReunionContext['contactStatus'];
  breakupReason: string;
  desiredOutcome: ReunionContext['desiredOutcome'];
  question: string;
  notes: string;
  consentToUsePartnerData: boolean;
};

export type ReunionRouteState = {
  formData?: IntakeFormData;
  reunionContext?: ReunionContext;
  tabOrigin?: string;
  draftOwnerId?: string;
  recoveredEntitlement?: {
    orderId: string;
    reportAccessToken: string;
  };
};

export function getReunionRouteContext(
  state?: Pick<ReunionRouteState, 'formData' | 'reunionContext'> | null
) {
  return state?.reunionContext || state?.formData?.reunionContext;
}

const emptyPerson = (): ReunionPersonDraft => ({
  name: '',
  gender: '',
  calendar: 'solar',
  isLeapMonth: false,
  birthDate: '',
  birthTime: '',
  isUnknownTime: false
});

export function createEmptyReunionDraft(): ReunionIntakeDraft {
  return {
    self: emptyPerson(),
    partner: emptyPerson(),
    breakupDuration: 'unknown',
    lastContactAt: '',
    contactStatus: 'unknown',
    breakupReason: '',
    desiredOutcome: 'unsure',
    question: '',
    notes: '',
    consentToUsePartnerData: false
  };
}

export const breakupDurationLabels: Readonly<Record<ReunionContext['breakupDuration'], string>> = {
  under1m: '한 달 미만',
  oneTo3m: '1~3개월',
  threeTo6m: '3~6개월',
  sixTo12m: '6~12개월',
  over1y: '1년 이상',
  unknown: '정확히 모르겠어요'
};

export const contactStatusLabels: Readonly<Record<ReunionContext['contactStatus'], string>> = {
  'no-contact': '현재 연락하지 않아요',
  occasional: '가끔 안부만 주고받아요',
  active: '지금도 대화하고 있어요',
  blocked: '차단되었거나 연락을 거절했어요',
  unknown: '상태를 판단하기 어려워요'
};

export const desiredOutcomeLabels: Readonly<Record<ReunionContext['desiredOutcome'], string>> = {
  reconnect: '다시 만나고 싶어요',
  closure: '미련을 정리하고 싶어요',
  clarity: '연락해도 될지 판단하고 싶어요',
  unsure: '아직 잘 모르겠어요'
};

export function createReunionFormData(draft: ReunionIntakeDraft): IntakeFormData {
  if (draft.self.gender !== 'male' && draft.self.gender !== 'female') {
    throw new Error('본인의 성별을 확인해 주세요.');
  }

  if (draft.partner.gender !== 'male' && draft.partner.gender !== 'female') {
    throw new Error('상대방의 성별을 확인해 주세요.');
  }

  const situationSummary = [
    `이별 후 기간: ${breakupDurationLabels[draft.breakupDuration]}`,
    `현재 연락: ${contactStatusLabels[draft.contactStatus]}`,
    draft.breakupReason.trim() ? `이별 배경: ${draft.breakupReason.trim()}` : ''
  ].filter(Boolean).join(' · ');

  return {
    name: draft.self.name.trim(),
    gender: draft.self.gender,
    calendar: draft.self.calendar,
    isLeapMonth: draft.self.calendar === 'lunar' && draft.self.isLeapMonth,
    birthDate: draft.self.birthDate,
    birthTime: draft.self.isUnknownTime ? '' : draft.self.birthTime,
    isUnknownTime: draft.self.isUnknownTime,
    birthTimePrecision: draft.self.isUnknownTime ? 'unknown' : 'exact',
    dayBoundaryPolicy: 'midnight',
    partner: {
      name: draft.partner.name.trim(),
      gender: draft.partner.gender,
      calendar: draft.partner.calendar,
      isLeapMonth: draft.partner.calendar === 'lunar' && draft.partner.isLeapMonth,
      birthDate: draft.partner.birthDate,
      birthTime: draft.partner.isUnknownTime ? '' : draft.partner.birthTime,
      isUnknownTime: draft.partner.isUnknownTime,
      birthTimePrecision: draft.partner.isUnknownTime ? 'unknown' : 'exact',
      dayBoundaryPolicy: 'midnight'
    },
    relationshipStatus: 'breakup-reunion',
    relationshipDuration: '',
    location: '',
    q1: draft.question.trim(),
    q2: situationSummary
  };
}

export function hydrateReunionDraft(
  formData?: Partial<IntakeFormData> | null,
  context?: Partial<ReunionContext> | null
): ReunionIntakeDraft {
  const draft = createEmptyReunionDraft();

  return {
    ...draft,
    self: {
      name: formData?.name || '',
      gender: formData?.gender === 'male' || formData?.gender === 'female' ? formData.gender : '',
      calendar: formData?.calendar === 'lunar' ? 'lunar' : 'solar',
      isLeapMonth: formData?.calendar === 'lunar' && Boolean(formData.isLeapMonth),
      birthDate: formData?.birthDate || '',
      birthTime: formData?.birthTime || '',
      isUnknownTime: Boolean(formData?.isUnknownTime)
    },
    partner: {
      name: formData?.partner?.name || '',
      gender: formData?.partner?.gender || '',
      calendar: formData?.partner?.calendar === 'lunar' ? 'lunar' : 'solar',
      isLeapMonth: formData?.partner?.calendar === 'lunar' && Boolean(formData.partner.isLeapMonth),
      birthDate: formData?.partner?.birthDate || '',
      birthTime: formData?.partner?.birthTime || '',
      isUnknownTime: Boolean(formData?.partner?.isUnknownTime)
    },
    breakupDuration: context?.breakupDuration || draft.breakupDuration,
    lastContactAt: context?.lastContactAt || '',
    contactStatus: context?.contactStatus || draft.contactStatus,
    breakupReason: context?.breakupReason || '',
    desiredOutcome: context?.desiredOutcome || draft.desiredOutcome,
    question: formData?.q1 || '',
    notes: context?.notes || '',
    consentToUsePartnerData: Boolean(context?.consentToUsePartnerData)
  };
}

export function buildReunionCheckoutState(
  formData: IntakeFormData,
  reunionContext: ReunionContext,
  ownerId?: string,
  tabOrigin: string = REUNION_PATHS.detail
) {
  return {
    product: REUNION_PRODUCT_ID,
    formData: { ...formData, reunionContext },
    reunionContext,
    tabOrigin,
    draftOwnerId: ownerId
  };
}
