import type { IntakeFormData } from '../../api/mockData';
import {
  createEmptyReunionContext,
  type ReunionContext,
  type ReunionIntakeData
} from './types';

export const REUNION_DRAFT_KEY = 'unwoldang.reunion-intake.v1';
export const REUNION_DRAFT_SCHEMA_VERSION = 'reunion-draft-v1' as const;
export const REUNION_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

const MAX_DRAFT_CLOCK_SKEW_MS = 5 * 60 * 1000;

const BASE_INTAKE: IntakeFormData = {
  name: '',
  gender: 'female',
  calendar: 'solar',
  isLeapMonth: false,
  birthDate: '',
  birthTime: '',
  isUnknownTime: false,
  birthTimePrecision: 'exact',
  dayBoundaryPolicy: 'midnight',
  relationshipStatus: 'breakup-reunion',
  relationshipDuration: '',
  location: '',
  q1: '',
  q2: ''
};
type UnknownRecord = Record<string, unknown>;

interface ReunionDraftEnvelope {
  schemaVersion: typeof REUNION_DRAFT_SCHEMA_VERSION;
  savedAt: string;
  data: ReunionIntakeData;
}

const genderValues = ['male', 'female'] as const;
const calendarValues = ['solar', 'lunar'] as const;
const birthTimePrecisionValues = ['exact', 'branch-range', 'unknown'] as const;
const dayBoundaryPolicyValues = ['midnight', 'late-zi'] as const;
const relationshipDurationValues = ['', 'under1', 'under3', 'under5', 'under10'] as const;
const requesterRoleValues = ['self', 'authorized-helper'] as const;
const birthAccuracyValues = ['documented', 'remembered', 'approximate', 'unknown'] as const;
const breakupInitiatorValues = ['self', 'partner', 'mutual', 'unclear'] as const;
const contactMoodValues = ['warm', 'neutral', 'cold', 'conflict', 'unknown'] as const;
const loveInterestValues = ['men', 'women', 'any', 'prefer-not-to-say'] as const;
const loveReactionValues = ['A', 'B', 'C', 'D'] as const;
const loveFocusValues = [
  'partner-type',
  'next-love-timing',
  'my-attraction',
  'repeated-pattern'
] as const;
const contactFrequencyValues = ['none', 'rare', 'weekly', 'frequent'] as const;
const blockStateValues = ['none', 'self-blocked', 'partner-blocked', 'mutual', 'unknown'] as const;
const newRelationshipValues = ['none', 'self', 'partner', 'both', 'unknown'] as const;
const distanceValues = ['same-area', 'domestic-distance', 'overseas', 'unknown'] as const;
const desiredOutcomeValues = ['reunion', 'conversation', 'apology', 'closure', 'undecided'] as const;
const readinessLevelValues = ['ready', 'shaky', 'not-ready'] as const;
const breakupReasonValues = [
  'communication',
  'trust',
  'distance',
  'family',
  'work',
  'money',
  'values',
  'marriage',
  'children',
  'infidelity',
  'emotional-exhaustion',
  'unclear'
] as const;
const questionValues = [
  'contact-temperature',
  'contact-timing',
  'contact-first',
  'reply-strategy',
  'meeting-strategy',
  'reunion-index',
  'recurrence-risk',
  'long-term-fit'
] as const;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = '', maxLength = 2_000) {
  return typeof value === 'string' ? value.slice(0, maxLength) : fallback;
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? value as T
    : fallback;
}

function nullableWholeNumber(
  value: unknown,
  fallback: number | null,
  min: number,
  max: number
) {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= min
    && value <= max
    ? value
    : fallback;
}

function optionalEnumValue<T extends string>(
  value: unknown,
  allowed: readonly T[]
): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? value as T
    : undefined;
}

function optionalStringValue(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.slice(0, maxLength) : undefined;
}

function enumArray<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: readonly T[],
  maxLength: number
): T[] {
  if (!Array.isArray(value)) return [...fallback];
  const normalized = value.filter(
    (item): item is T => typeof item === 'string'
      && (allowed as readonly string[]).includes(item)
  );
  return [...new Set(normalized)].slice(0, maxLength);
}

function normalizeBirthLocation(value: unknown) {
  if (!isRecord(value)) return undefined;
  const label = stringValue(value.label, '', 160);
  if (!label) return undefined;

  const numberInRange = (candidate: unknown, min: number, max: number) => (
    typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= min && candidate <= max
      ? candidate
      : undefined
  );

  return {
    label,
    latitude: numberInRange(value.latitude, -90, 90),
    longitude: numberInRange(value.longitude, -180, 180),
    timezone: typeof value.timezone === 'string' ? value.timezone.slice(0, 80) : undefined,
    utcOffsetMinutes: numberInRange(value.utcOffsetMinutes, -840, 840),
    applySolarTimeCorrection: typeof value.applySolarTimeCorrection === 'boolean'
      ? value.applySolarTimeCorrection
      : undefined
  };
}
function normalizeReunionContext(value: unknown, fallback: ReunionContext): ReunionContext {
  const source = isRecord(value) ? value : {};
  const facts = isRecord(source.facts) ? source.facts : {};
  const safety = isRecord(source.safety) ? source.safety : {};
  const readiness = isRecord(source.readiness) ? source.readiness : {};
  const selectedQuestions = enumArray(
    source.selectedQuestions,
    questionValues,
    fallback.selectedQuestions,
    5
  );

  return {
    schemaVersion: 'reunion-intake-v1',
    analysisDate: stringValue(source.analysisDate, fallback.analysisDate, 10),
    requesterRole: enumValue(source.requesterRole, requesterRoleValues, fallback.requesterRole),
    adultConfirmed: booleanValue(source.adultConfirmed, fallback.adultConfirmed),
    dataUseConsent: booleanValue(source.dataUseConsent, fallback.dataUseConsent),
    dataAuthorityConfirmed: booleanValue(
      source.dataAuthorityConfirmed,
      fallback.dataAuthorityConfirmed
    ),
    selfBirthAccuracy: enumValue(
      source.selfBirthAccuracy,
      birthAccuracyValues,
      fallback.selfBirthAccuracy
    ),
    partnerBirthAccuracy: enumValue(
      source.partnerBirthAccuracy,
      birthAccuracyValues,
      fallback.partnerBirthAccuracy
    ),
    partnerBirthKnown: booleanValue(source.partnerBirthKnown, fallback.partnerBirthKnown),
    facts: {
      relationshipStartDate: stringValue(
        facts.relationshipStartDate,
        fallback.facts.relationshipStartDate,
        10
      ),
      breakupDate: stringValue(facts.breakupDate, fallback.facts.breakupDate, 10),
      relationshipLengthMonths: nullableWholeNumber(
        facts.relationshipLengthMonths,
        fallback.facts.relationshipLengthMonths,
        0,
        1_200
      ),
      daysSinceBreakup: nullableWholeNumber(
        facts.daysSinceBreakup,
        fallback.facts.daysSinceBreakup,
        0,
        365_000
      ),
      breakupInitiator: enumValue(
        facts.breakupInitiator,
        breakupInitiatorValues,
        fallback.facts.breakupInitiator
      ),
      breakupReasons: enumArray(
        facts.breakupReasons,
        breakupReasonValues,
        fallback.facts.breakupReasons,
        breakupReasonValues.length
      ),
      breakupReasonDetail: stringValue(
        facts.breakupReasonDetail,
        fallback.facts.breakupReasonDetail,
        1_000
      ),
      pastReunionCount: nullableWholeNumber(
        facts.pastReunionCount,
        fallback.facts.pastReunionCount,
        0,
        100
      ) ?? fallback.facts.pastReunionCount,
      repeatedCause: booleanValue(facts.repeatedCause, fallback.facts.repeatedCause),
      lastContactDate: stringValue(facts.lastContactDate, fallback.facts.lastContactDate, 10),
      daysSinceLastContact: nullableWholeNumber(
        facts.daysSinceLastContact,
        fallback.facts.daysSinceLastContact,
        0,
        365_000
      ),
      lastContactMood: enumValue(
        facts.lastContactMood,
        contactMoodValues,
        fallback.facts.lastContactMood
      ),
      contactFrequency: enumValue(
        facts.contactFrequency,
        contactFrequencyValues,
        fallback.facts.contactFrequency
      ),
      blockState: enumValue(facts.blockState, blockStateValues, fallback.facts.blockState),
      newRelationship: enumValue(
        facts.newRelationship,
        newRelationshipValues,
        fallback.facts.newRelationship
      ),
      distance: enumValue(facts.distance, distanceValues, fallback.facts.distance),
      familyObstacle: booleanValue(facts.familyObstacle, fallback.facts.familyObstacle),
      workObstacle: booleanValue(facts.workObstacle, fallback.facts.workObstacle),
      moneyObstacle: booleanValue(facts.moneyObstacle, fallback.facts.moneyObstacle),
      trustObstacle: booleanValue(facts.trustObstacle, fallback.facts.trustObstacle),
      valuesObstacle: booleanValue(facts.valuesObstacle, fallback.facts.valuesObstacle),
      marriageObstacle: booleanValue(facts.marriageObstacle, fallback.facts.marriageObstacle),
      childrenObstacle: booleanValue(facts.childrenObstacle, fallback.facts.childrenObstacle)
    },
    safety: {
      explicitNoContact: booleanValue(safety.explicitNoContact, fallback.safety.explicitNoContact),
      stalkingOrReport: booleanValue(safety.stalkingOrReport, fallback.safety.stalkingOrReport),
      violence: booleanValue(safety.violence, fallback.safety.violence),
      threats: booleanValue(safety.threats, fallback.safety.threats),
      coerciveControl: booleanValue(safety.coerciveControl, fallback.safety.coerciveControl),
      financialExploitation: booleanValue(
        safety.financialExploitation,
        fallback.safety.financialExploitation
      ),
      selfHarmPressure: booleanValue(safety.selfHarmPressure, fallback.safety.selfHarmPressure),
      blockCircumventionAttempt: booleanValue(
        safety.blockCircumventionAttempt,
        fallback.safety.blockCircumventionAttempt
      ),
      disruptingNewRelationship: booleanValue(
        safety.disruptingNewRelationship,
        fallback.safety.disruptingNewRelationship
      )
    },
    readiness: {
      accountabilityTaken: booleanValue(
        readiness.accountabilityTaken,
        fallback.readiness.accountabilityTaken
      ),
      breakupCauseChanged: booleanValue(
        readiness.breakupCauseChanged,
        fallback.readiness.breakupCauseChanged
      ),
      canAcceptNoReply: booleanValue(
        readiness.canAcceptNoReply,
        fallback.readiness.canAcceptNoReply
      ),
      canRespectBoundary: booleanValue(
        readiness.canRespectBoundary,
        fallback.readiness.canRespectBoundary
      ),
      supportAvailable: booleanValue(
        readiness.supportAvailable,
        fallback.readiness.supportAvailable
      ),
      level: enumValue(readiness.level, readinessLevelValues, fallback.readiness.level)
    },
    selectedQuestions: selectedQuestions.length ? selectedQuestions : [...fallback.selectedQuestions],
    customQuestion: stringValue(source.customQuestion, fallback.customQuestion, 500),
    messageDraft: stringValue(source.messageDraft, fallback.messageDraft, 2_000),
    desiredOutcome: enumValue(
      source.desiredOutcome,
      desiredOutcomeValues,
      fallback.desiredOutcome
    ),
    fearedOutcome: stringValue(source.fearedOutcome, fallback.fearedOutcome, 500),
    attemptedContactSummary: stringValue(
      source.attemptedContactSummary,
      fallback.attemptedContactSummary,
      1_000
    )
  };
}

export function createEmptyReunionIntake(
  today = new Date().toISOString().slice(0, 10)
): ReunionIntakeData {
  return {
    ...BASE_INTAKE,
    partner: {
      name: '',
      gender: 'male',
      calendar: 'solar',
      isLeapMonth: false,
      birthDate: '',
      birthTime: '',
      isUnknownTime: false,
      birthTimePrecision: 'exact',
      dayBoundaryPolicy: 'midnight'
    },
    reunion: createEmptyReunionContext(today)
  };
}

export function hydrateReunionIntake(
  source?: Partial<ReunionIntakeData> | null,
  today = new Date().toISOString().slice(0, 10)
): ReunionIntakeData {
  const empty = createEmptyReunionIntake(today);
  const root: UnknownRecord = isRecord(source) ? source : {};
  const partnerSource: UnknownRecord = isRecord(root.partner) ? root.partner : {};
  const defaultPartner = empty.partner!;

  return {
    name: stringValue(root.name, empty.name, 80),
    gender: enumValue(root.gender, genderValues, empty.gender),
    interestedIn: optionalEnumValue(root.interestedIn, loveInterestValues),
    calendar: enumValue(root.calendar, calendarValues, empty.calendar),
    isLeapMonth: booleanValue(root.isLeapMonth, empty.isLeapMonth),
    birthDate: stringValue(root.birthDate, empty.birthDate, 10),
    birthTime: stringValue(root.birthTime, empty.birthTime, 5),
    isUnknownTime: booleanValue(root.isUnknownTime, empty.isUnknownTime),
    birthTimePrecision: enumValue(
      root.birthTimePrecision,
      birthTimePrecisionValues,
      empty.birthTimePrecision || 'exact'
    ),
    dayBoundaryPolicy: enumValue(
      root.dayBoundaryPolicy,
      dayBoundaryPolicyValues,
      empty.dayBoundaryPolicy || 'midnight'
    ),
    birthLocation: normalizeBirthLocation(root.birthLocation),
    partner: {
      name: stringValue(partnerSource.name, defaultPartner.name, 80),
      gender: enumValue(partnerSource.gender, genderValues, defaultPartner.gender),
      calendar: enumValue(partnerSource.calendar, calendarValues, defaultPartner.calendar),
      isLeapMonth: booleanValue(partnerSource.isLeapMonth, defaultPartner.isLeapMonth),
      birthDate: stringValue(partnerSource.birthDate, defaultPartner.birthDate, 10),
      birthTime: stringValue(partnerSource.birthTime, defaultPartner.birthTime, 5),
      isUnknownTime: booleanValue(
        partnerSource.isUnknownTime,
        defaultPartner.isUnknownTime
      ),
      birthTimePrecision: enumValue(
        partnerSource.birthTimePrecision,
        birthTimePrecisionValues,
        defaultPartner.birthTimePrecision || 'exact'
      ),
      dayBoundaryPolicy: enumValue(
        partnerSource.dayBoundaryPolicy,
        dayBoundaryPolicyValues,
        defaultPartner.dayBoundaryPolicy || 'midnight'
      ),
      birthLocation: normalizeBirthLocation(partnerSource.birthLocation)
    },
    relationshipStatus: 'breakup-reunion',
    relationshipDuration: enumValue(
      root.relationshipDuration,
      relationshipDurationValues,
      empty.relationshipDuration
    ),
    loveReaction: optionalEnumValue(root.loveReaction, loveReactionValues),
    loveFocus: optionalEnumValue(root.loveFocus, loveFocusValues),
    location: stringValue(root.location, empty.location, 160),
    q1: stringValue(root.q1, empty.q1, 160),
    q2: stringValue(root.q2, empty.q2, 160),
    pastLifeTopic: optionalStringValue(root.pastLifeTopic, 500),
    repeatedScene: optionalStringValue(root.repeatedScene, 500),
    frequentEmotion: optionalStringValue(root.frequentEmotion, 500),
    hiddenDesire: optionalStringValue(root.hiddenDesire, 500),
    chosenSymbol: optionalStringValue(root.chosenSymbol, 200),
    readingTone: optionalStringValue(root.readingTone, 200),
    reunion: normalizeReunionContext(root.reunion, empty.reunion)
  };
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validTime(value: string, unknown: boolean) {
  return unknown || /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function validateReunionStep(
  step: number,
  input: ReunionIntakeData
): string[] {
  const errors: string[] = [];
  if (step === 1) {
    if (!input.reunion.adultConfirmed) errors.push('성인 확인이 필요합니다.');
    if (!input.reunion.dataUseConsent) errors.push('민감정보 처리 동의가 필요합니다.');
    if (!input.reunion.dataAuthorityConfirmed) errors.push('정보 사용 권한 확인이 필요합니다.');
    if (input.name.trim().length < 1) errors.push('이름을 입력해 주세요.');
    if (!validDate(input.birthDate)) errors.push('본인 생년월일을 확인해 주세요.');
    if (!validTime(input.birthTime, input.isUnknownTime)) errors.push('본인 태어난 시간을 확인해 주세요.');
  }
  if (step === 2 && input.reunion.partnerBirthKnown) {
    if (!input.partner?.name?.trim()) errors.push('상대 이름 또는 호칭을 입력해 주세요.');
    if (!validDate(input.partner?.birthDate || '')) errors.push('상대 생년월일을 확인해 주세요.');
    if (!validTime(input.partner?.birthTime || '', Boolean(input.partner?.isUnknownTime))) {
      errors.push('상대 태어난 시간을 확인해 주세요.');
    }
  }
  if (step === 3) {
    if (!validDate(input.reunion.facts.breakupDate)) errors.push('이별 날짜를 입력해 주세요.');
    if (input.reunion.facts.breakupReasons.length === 0) errors.push('이별 원인을 한 가지 이상 골라 주세요.');
  }
  if (step === 4) {
    if (input.reunion.facts.lastContactMood === 'unknown') {
      errors.push('마지막 연락 분위기를 골라 주세요.');
    }
    if (input.reunion.facts.blockState === 'unknown') {
      errors.push('현재 차단 상태를 골라 주세요.');
    }
    if (input.reunion.facts.newRelationship === 'unknown') {
      errors.push('현재 새 관계 여부를 골라 주세요.');
    }
  }
  if (step === 6 && !input.reunion.readiness.canRespectBoundary) {
    errors.push('경계를 지킬 수 없다면 연락 전략 대신 회복 계획을 선택해야 합니다.');
  }
  if (step === 7) {
    if (input.reunion.selectedQuestions.length < 3) {
      errors.push('가장 궁금한 질문을 3개 이상 골라 주세요.');
    }
    if (input.reunion.selectedQuestions.length > 5) {
      errors.push('핵심 질문은 최대 5개까지 고를 수 있습니다.');
    }
  }
  return errors;
}

export function isReunionIntakeReady(input: ReunionIntakeData) {
  return Array.from({ length: 7 }, (_, index) => index + 1)
    .every((step) => validateReunionStep(step, input).length === 0);
}

export function finalizeReunionIntake(input: ReunionIntakeData): ReunionIntakeData {
  const selected = input.reunion.selectedQuestions;
  return {
    ...input,
    name: input.name.trim(),
    relationshipStatus: 'breakup-reunion',
    q1: selected[0] || 'reunion-index',
    q2: selected[1] || 'recurrence-risk',
    partner: input.reunion.partnerBirthKnown && input.partner?.birthDate
      ? { ...input.partner, name: input.partner.name.trim() }
      : undefined,
    reunion: {
      ...input.reunion,
      customQuestion: input.reunion.customQuestion.trim(),
      messageDraft: input.reunion.messageDraft.trim(),
      fearedOutcome: input.reunion.fearedOutcome.trim(),
      attemptedContactSummary: input.reunion.attemptedContactSummary.trim(),
      facts: {
        ...input.reunion.facts,
        breakupReasonDetail: input.reunion.facts.breakupReasonDetail.trim()
      }
    }
  };
}

function discardReunionDraft() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(REUNION_DRAFT_KEY);
  } catch {
    // Storage access can be denied in privacy modes; there is nothing else to clear.
  }
}

export function readReunionDraft(): ReunionIntakeData | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(REUNION_DRAFT_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (
      !isRecord(parsed)
      || parsed.schemaVersion !== REUNION_DRAFT_SCHEMA_VERSION
      || typeof parsed.savedAt !== 'string'
      || !isRecord(parsed.data)
      || !isRecord(parsed.data.reunion)
      || parsed.data.reunion.schemaVersion !== 'reunion-intake-v1'
    ) {
      discardReunionDraft();
      return null;
    }

    const savedAt = Date.parse(parsed.savedAt);
    const now = Date.now();
    if (
      !Number.isFinite(savedAt)
      || new Date(savedAt).toISOString() !== parsed.savedAt
      || savedAt > now + MAX_DRAFT_CLOCK_SKEW_MS
      || now - savedAt > REUNION_DRAFT_TTL_MS
    ) {
      discardReunionDraft();
      return null;
    }

    return hydrateReunionIntake(parsed.data as Partial<ReunionIntakeData>);
  } catch {
    discardReunionDraft();
    return null;
  }
}

export function saveReunionDraft(input: ReunionIntakeData) {
  if (typeof window === 'undefined') return;

  // This session-only local payload contains sensitive names, birth data and relationship details.
  // Keep it short-lived, schema-versioned and never infer server-side consent from its presence.
  const payload: ReunionDraftEnvelope = {
    schemaVersion: REUNION_DRAFT_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    data: hydrateReunionIntake(input)
  };

  try {
    window.sessionStorage.setItem(REUNION_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    // A failed draft write must not interrupt the intake flow.
  }
}

export function clearReunionDraft() {
  discardReunionDraft();
}
