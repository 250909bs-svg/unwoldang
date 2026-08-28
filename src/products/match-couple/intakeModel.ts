import type { BirthLocationData, IntakeFormData, PartnerBirthData } from '../../api/mockData';
import { validateBirthInput } from '../../lib/birthInputValidation';
import {
  MATCH_COUPLE_CONTEXT_VERSION,
  type MatchCoupleContext,
  type MatchCoupleInputValidation,
  type MatchCoupleIntakeState,
  type MatchCouplePersonInput,
  type MatchCoupleRelationshipDuration,
  type MatchCoupleStoredFormData
} from './types';

export const matchCoupleBirthLocations: BirthLocationData[] = [
  { label: '서울', latitude: 37.5665, longitude: 126.978, timezone: 'Asia/Seoul', utcOffsetMinutes: 540, applySolarTimeCorrection: true },
  { label: '인천', latitude: 37.4563, longitude: 126.7052, timezone: 'Asia/Seoul', utcOffsetMinutes: 540, applySolarTimeCorrection: true },
  { label: '대전', latitude: 36.3504, longitude: 127.3845, timezone: 'Asia/Seoul', utcOffsetMinutes: 540, applySolarTimeCorrection: true },
  { label: '대구', latitude: 35.8714, longitude: 128.6014, timezone: 'Asia/Seoul', utcOffsetMinutes: 540, applySolarTimeCorrection: true },
  { label: '광주', latitude: 35.1595, longitude: 126.8526, timezone: 'Asia/Seoul', utcOffsetMinutes: 540, applySolarTimeCorrection: true },
  { label: '부산', latitude: 35.1796, longitude: 129.0756, timezone: 'Asia/Seoul', utcOffsetMinutes: 540, applySolarTimeCorrection: true },
  { label: '제주', latitude: 33.4996, longitude: 126.5312, timezone: 'Asia/Seoul', utcOffsetMinutes: 540, applySolarTimeCorrection: true }
];

const relationshipStatusLabels: Record<Exclude<MatchCoupleContext['relationshipStatus'], ''>, string> = {
  situationship: '썸·알아가는 중',
  dating: '연애 중',
  ambiguous: '애매한 관계',
  'breakup-reunion': '이별·재회 고민',
  married: '기혼·동거 중'
};

const relationshipDurationLabels: Record<MatchCoupleRelationshipDuration, string> = {
  under1: '1년 미만',
  under3: '1~3년',
  under5: '3~5년',
  under10: '5~10년',
  over10: '10년 이상'
};

function emptyPerson(): MatchCouplePersonInput {
  return {
    name: '',
    gender: 'female',
    calendar: 'solar',
    isLeapMonth: false,
    birthDate: '',
    birthTime: '',
    isUnknownTime: false,
    isUnknownLocation: false,
    birthLocation: undefined
  };
}

export function createEmptyMatchCoupleIntake(): MatchCoupleIntakeState {
  return {
    self: emptyPerson(),
    partner: { ...emptyPerson(), gender: 'male' },
    context: {
      version: MATCH_COUPLE_CONTEXT_VERSION,
      relationshipStatus: '',
      relationshipDuration: '',
      majorConflict: '',
      desiredInsight: '',
      questions: ['', ''],
      selfLocationUnknown: false,
      partnerLocationUnknown: false,
      selfSolarTimeCorrectionRequested: false,
      partnerSolarTimeCorrectionRequested: false
    }
  };
}

function normalizePerson(person: MatchCouplePersonInput): MatchCouplePersonInput {
  return {
    ...person,
    name: person.name.trim(),
    birthDate: person.birthDate.trim(),
    birthTime: person.isUnknownTime ? '' : person.birthTime.trim(),
    isLeapMonth: person.calendar === 'lunar' && person.isLeapMonth,
    birthLocation: person.isUnknownLocation ? undefined : person.birthLocation
  };
}

function serverBirthLocation(person: MatchCouplePersonInput) {
/**
 * The shared generator needs an invariant civil day. The versioned context
 * retains the requested correction so the dedicated model can restore it.
 */
  if (!person.birthLocation || !person.isUnknownTime) return person.birthLocation;

  return {
    ...person.birthLocation,
    applySolarTimeCorrection: false
  };
}

function toPartnerBirthData(person: MatchCouplePersonInput): PartnerBirthData {
  const normalized = normalizePerson(person);
  return {
    name: normalized.name,
    gender: normalized.gender,
    calendar: normalized.calendar,
    isLeapMonth: normalized.isLeapMonth,
    birthDate: normalized.birthDate,
    birthTime: normalized.birthTime,
    isUnknownTime: normalized.isUnknownTime,
    birthTimePrecision: normalized.isUnknownTime ? 'unknown' : 'exact',
    dayBoundaryPolicy: 'midnight',
    birthLocation: serverBirthLocation(normalized)
  };
}

export function getMatchCoupleRelationshipSummary(context: MatchCoupleContext) {
  const status = context.relationshipStatus
    ? relationshipStatusLabels[context.relationshipStatus]
    : '관계 상태 미입력';
  const duration = context.relationshipDuration
    ? relationshipDurationLabels[context.relationshipDuration]
    : '기간 미입력';
  return `${status} · ${duration}`;
}

function buildQuestionForAnalysis(context: MatchCoupleContext, index: 0 | 1) {
  const relationship = getMatchCoupleRelationshipSummary(context);
  const conflict = context.majorConflict.trim() || '별도 입력 없음';
  const desired = context.desiredInsight.trim() || '별도 입력 없음';
  const question = context.questions[index].trim();
  return `[궁합 관계 맥락] ${relationship}\n[주요 갈등] ${conflict}\n[알고 싶은 점] ${desired}\n[질문 ${index + 1}] ${question}`;
}

export function serializeMatchCoupleIntake(state: MatchCoupleIntakeState): MatchCoupleStoredFormData {
  const self = normalizePerson(state.self);
  const partner = normalizePerson(state.partner);
  const context: MatchCoupleContext = {
    ...state.context,
    version: MATCH_COUPLE_CONTEXT_VERSION,
    majorConflict: state.context.majorConflict.trim(),
    desiredInsight: state.context.desiredInsight.trim(),
    questions: [state.context.questions[0].trim(), state.context.questions[1].trim()],
    selfLocationUnknown: self.isUnknownLocation,
    partnerLocationUnknown: partner.isUnknownLocation,
    selfSolarTimeCorrectionRequested: Boolean(self.birthLocation?.applySolarTimeCorrection),
    partnerSolarTimeCorrectionRequested: Boolean(partner.birthLocation?.applySolarTimeCorrection)
  };
  const sharedDuration = context.relationshipDuration === 'over10'
    ? 'under10'
    : context.relationshipDuration;

  return {
    name: self.name,
    gender: self.gender,
    calendar: self.calendar,
    isLeapMonth: self.isLeapMonth,
    birthDate: self.birthDate,
    birthTime: self.birthTime,
    isUnknownTime: self.isUnknownTime,
    birthTimePrecision: self.isUnknownTime ? 'unknown' : 'exact',
    dayBoundaryPolicy: 'midnight',
    birthLocation: serverBirthLocation(self),
    partner: toPartnerBirthData(partner),
    relationshipStatus: context.relationshipStatus,
    relationshipDuration: sharedDuration || '',
    location: self.birthLocation?.label || '',
    q1: buildQuestionForAnalysis(context, 0),
    q2: buildQuestionForAnalysis(context, 1),
    matchCoupleContext: context
  };
}

function personFromStored(
  source: Partial<IntakeFormData> | PartnerBirthData | undefined,
  locationUnknown: boolean,
  solarTimeCorrectionRequested: boolean
) {
  const empty = emptyPerson();
  if (!source) return { ...empty, isUnknownLocation: locationUnknown };
  const storedLocation = locationUnknown
    ? undefined
    : source.birthLocation;
  return {
    ...empty,
    name: source.name || '',
    gender: source.gender === 'male' ? 'male' as const : 'female' as const,
    calendar: source.calendar === 'lunar' ? 'lunar' as const : 'solar' as const,
    isLeapMonth: Boolean(source.isLeapMonth),
    birthDate: source.birthDate || '',
    birthTime: source.isUnknownTime ? '' : source.birthTime || '',
    isUnknownTime: Boolean(source.isUnknownTime),
    isUnknownLocation: locationUnknown,
    birthLocation: storedLocation
      ? {
          ...storedLocation,
          applySolarTimeCorrection:
            solarTimeCorrectionRequested || Boolean(storedLocation.applySolarTimeCorrection)
        }
      : undefined
  };
}

export function hydrateMatchCoupleIntake(source?: Partial<MatchCoupleStoredFormData>): MatchCoupleIntakeState {
  const fallback = createEmptyMatchCoupleIntake();
  const storedContext = source?.matchCoupleContext;
  if (!source || storedContext?.version !== MATCH_COUPLE_CONTEXT_VERSION) return fallback;
  const context: MatchCoupleContext = {
    ...fallback.context,
    ...storedContext,
    questions: [storedContext.questions?.[0] || '', storedContext.questions?.[1] || '']
  };
  return {
    self: personFromStored(
      source,
      context.selfLocationUnknown,
      context.selfSolarTimeCorrectionRequested
    ),
    partner: personFromStored(
      source.partner,
      context.partnerLocationUnknown,
      context.partnerSolarTimeCorrectionRequested
    ),
    context
  };
}

function validatePerson(person: MatchCouplePersonInput, subjectLabel: string) {
  return validateBirthInput(toPartnerBirthData(person), { subjectLabel });
}

export function validateMatchCoupleIntake(state: MatchCoupleIntakeState): MatchCoupleInputValidation {
  const self = validatePerson(state.self, '본인');
  const partner = validatePerson(state.partner, '상대방');
  const stepErrors: MatchCoupleInputValidation['stepErrors'] = {
    1: self.errors.map((error) => error.message),
    2: partner.errors.map((error) => error.message),
    3: [],
    4: []
  };
  if (!state.self.isUnknownLocation && !state.self.birthLocation) {
    stepErrors[1].push('본인의 출생지역을 선택하거나 지역 미상을 체크해 주세요.');
  }
  if (!state.partner.isUnknownLocation && !state.partner.birthLocation) {
    stepErrors[2].push('상대방의 출생지역을 선택하거나 지역 미상을 체크해 주세요.');
  }
  if (!state.context.relationshipStatus) stepErrors[3].push('현재 관계 상태를 선택해 주세요.');
  if (!state.context.relationshipDuration) stepErrors[3].push('관계 기간을 선택해 주세요.');
  if (!state.context.majorConflict.trim()) stepErrors[3].push('두 사람의 주요 갈등을 적어 주세요.');
  if (!state.context.desiredInsight.trim()) stepErrors[3].push('이번 궁합에서 알고 싶은 점을 적어 주세요.');
  if (!state.context.questions[0].trim()) stepErrors[4].push('첫 번째 질문을 입력해 주세요.');
  if (!state.context.questions[1].trim()) stepErrors[4].push('두 번째 질문을 입력해 주세요.');
  return {
    valid: Object.values(stepErrors).every((errors) => errors.length === 0),
    stepErrors
  };
}
