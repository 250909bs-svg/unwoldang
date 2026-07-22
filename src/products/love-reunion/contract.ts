import type {
  BirthLocationData,
  BirthTimePrecision,
  DayBoundaryPolicy,
  IntakeFormData,
  PartnerBirthData
} from '../../api/mockData';
import {
  validateBirthInput,
  type BirthInputValidationResult
} from '../../lib/birthInputValidation';

export const LOVE_REUNION_CONTEXT_VERSION = 2 as const;

export const LOVE_REUNION_RELATIONSHIP_STATES = [
  'separated-no-contact',
  'separated-contacting',
  'ambiguous',
  'reconnecting',
  'closure'
] as const;

export const LOVE_REUNION_RELATIONSHIP_LENGTHS = [
  'under-3-months',
  '3-to-12-months',
  '1-to-3-years',
  '3-to-5-years',
  'over-5-years'
] as const;

export const LOVE_REUNION_BREAKUP_ELAPSED_OPTIONS = [
  'under-1-week',
  '1-to-4-weeks',
  '1-to-3-months',
  '3-to-6-months',
  'over-6-months'
] as const;

export const LOVE_REUNION_LAST_CONTACT_TIMINGS = [
  'today',
  'under-1-week',
  'under-1-month',
  '1-to-3-months',
  'over-3-months',
  'never',
  'unknown'
] as const;

export const LOVE_REUNION_CURRENT_CONTACT_OPTIONS = [
  'none',
  'blocked',
  'practical-only',
  'occasional',
  'friendly',
  'reconnecting'
] as const;

export const LOVE_REUNION_CONTACT_BOUNDARIES = [
  'none',
  'explicit-no-contact',
  'safety-risk'
] as const;

export const LOVE_REUNION_BREAKUP_REASONS = [
  'communication',
  'trust',
  'distance',
  'timing',
  'conflict',
  'values',
  'other'
] as const;

export const LOVE_REUNION_TEXT_LIMITS = Object.freeze({
  name: 12,
  birthDate: 10,
  birthTime: 40,
  location: 120,
  lastContactNote: 240,
  breakupReasonDetail: 300,
  reunionReason: 300,
  question: 180
});

export const LOVE_REUNION_DRAFT_KEY = 'unwoldang.intake.love-reunion';
export const LOVE_REUNION_CHECKOUT_INTENT_KEY = 'unwoldang.checkout.intent.love-reunion.v1';

export type LoveReunionRelationshipState = '' | (typeof LOVE_REUNION_RELATIONSHIP_STATES)[number];
export type LoveReunionRelationshipLength = '' | (typeof LOVE_REUNION_RELATIONSHIP_LENGTHS)[number];
export type LoveReunionBreakupElapsed = '' | (typeof LOVE_REUNION_BREAKUP_ELAPSED_OPTIONS)[number];
export type LoveReunionLastContactTiming = '' | (typeof LOVE_REUNION_LAST_CONTACT_TIMINGS)[number];
export type LoveReunionCurrentContact = '' | (typeof LOVE_REUNION_CURRENT_CONTACT_OPTIONS)[number];
export type LoveReunionContactBoundary = '' | (typeof LOVE_REUNION_CONTACT_BOUNDARIES)[number];
export type LoveReunionBreakupReason = '' | (typeof LOVE_REUNION_BREAKUP_REASONS)[number];

export interface LoveReunionContext {
  version: typeof LOVE_REUNION_CONTEXT_VERSION;
  relationshipState: LoveReunionRelationshipState;
  relationshipLength: LoveReunionRelationshipLength;
  breakupElapsed: LoveReunionBreakupElapsed;
  lastContactTiming: LoveReunionLastContactTiming;
  lastContactNote: string;
  currentContact: LoveReunionCurrentContact;
  contactBoundary: LoveReunionContactBoundary;
  breakupReason: LoveReunionBreakupReason;
  breakupReasonDetail: string;
  reunionReason: string;
  partnerBirthKnown: boolean;
  partnerDataPermissionConfirmed: boolean;
}

export type LoveReunionFormData = IntakeFormData & {
  reunionContext: LoveReunionContext;
};

export interface LoveReunionValidationResult {
  valid: boolean;
  errors: string[];
  self: BirthInputValidationResult;
  partner: BirthInputValidationResult | null;
}

type UnknownRecord = Record<string, unknown>;

const GENDERS = ['male', 'female'] as const;
const CALENDARS = ['solar', 'lunar'] as const;
const BIRTH_TIME_PRECISIONS = ['exact', 'branch-range', 'unknown'] as const;
const DAY_BOUNDARY_POLICIES = ['midnight', 'late-zi'] as const;
const LEGACY_RELATIONSHIP_DURATIONS = ['under1', 'under3', 'under5', 'under10'] as const;
const EXACT_TIME_PATTERN = /^(?:[01]?\d|2[0-3]):[0-5]\d$/;

export const LOVE_REUNION_RELATIONSHIP_DURATION_MAP: Readonly<
  Record<LoveReunionRelationshipLength, IntakeFormData['relationshipDuration']>
> = Object.freeze({
  '': '',
  'under-3-months': 'under1',
  '3-to-12-months': 'under1',
  '1-to-3-years': 'under3',
  '3-to-5-years': 'under5',
  'over-5-years': 'under10'
});

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeText(value: unknown, maxLength: number, trim = true): string {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = trim ? value.trim() : value;
  return normalized.slice(0, maxLength);
}

function normalizeAllowed<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback;
}

function normalizeSelection<T extends string>(value: unknown, allowed: readonly T[]): '' | T {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : '';
}

function normalizeFiniteNumber(value: unknown, minimum: number, maximum: number) {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
    ? value
    : undefined;
}

function normalizeBirthLocation(value: unknown): BirthLocationData | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const label = normalizeText(value.label, LOVE_REUNION_TEXT_LIMITS.location);
  if (!label) {
    return undefined;
  }

  const latitude = normalizeFiniteNumber(value.latitude, -90, 90);
  const longitude = normalizeFiniteNumber(value.longitude, -180, 180);
  const utcOffsetMinutes = normalizeFiniteNumber(value.utcOffsetMinutes, -840, 840);
  const timezone = normalizeText(value.timezone, 80);

  return {
    label,
    ...(latitude === undefined ? {} : { latitude }),
    ...(longitude === undefined ? {} : { longitude }),
    ...(timezone ? { timezone } : {}),
    ...(utcOffsetMinutes === undefined ? {} : { utcOffsetMinutes }),
    ...(typeof value.applySolarTimeCorrection === 'boolean'
      ? { applySolarTimeCorrection: value.applySolarTimeCorrection }
      : {})
  };
}

function normalizeBirthTimeFields(source: UnknownRecord): {
  birthTime: string;
  isUnknownTime: boolean;
  birthTimePrecision: BirthTimePrecision;
} {
  const isUnknownTime = source.isUnknownTime === true;
  const birthTime = isUnknownTime
    ? ''
    : normalizeText(source.birthTime, LOVE_REUNION_TEXT_LIMITS.birthTime);
  const requestedPrecision = normalizeAllowed(
    source.birthTimePrecision,
    BIRTH_TIME_PRECISIONS,
    'branch-range'
  );
  const birthTimePrecision: BirthTimePrecision = isUnknownTime
    ? 'unknown'
    : EXACT_TIME_PATTERN.test(birthTime)
      ? 'exact'
      : birthTime
        ? 'branch-range'
        : requestedPrecision === 'unknown'
          ? 'branch-range'
          : requestedPrecision;

  return { birthTime, isUnknownTime, birthTimePrecision };
}

function normalizeDayBoundaryPolicy(value: unknown): DayBoundaryPolicy {
  return normalizeAllowed(value, DAY_BOUNDARY_POLICIES, 'midnight');
}

function normalizePartner(value: unknown): PartnerBirthData | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const calendar = normalizeAllowed(value.calendar, CALENDARS, 'solar');
  const time = normalizeBirthTimeFields(value);

  return {
    name: normalizeText(value.name, LOVE_REUNION_TEXT_LIMITS.name),
    gender: normalizeAllowed(value.gender, GENDERS, 'male'),
    calendar,
    isLeapMonth: calendar === 'lunar' && value.isLeapMonth === true,
    birthDate: normalizeText(value.birthDate, LOVE_REUNION_TEXT_LIMITS.birthDate),
    ...time,
    dayBoundaryPolicy: normalizeDayBoundaryPolicy(value.dayBoundaryPolicy),
    birthLocation: normalizeBirthLocation(value.birthLocation)
  };
}

export function createEmptyLoveReunionContext(): LoveReunionContext {
  return {
    version: LOVE_REUNION_CONTEXT_VERSION,
    relationshipState: '',
    relationshipLength: '',
    breakupElapsed: '',
    lastContactTiming: '',
    lastContactNote: '',
    currentContact: '',
    contactBoundary: '',
    breakupReason: '',
    breakupReasonDetail: '',
    reunionReason: '',
    partnerBirthKnown: false,
    partnerDataPermissionConfirmed: false
  };
}

export function createEmptyLoveReunionFormData(): LoveReunionFormData {
  return {
    name: '',
    gender: 'female',
    calendar: 'solar',
    isLeapMonth: false,
    birthDate: '',
    birthTime: '',
    isUnknownTime: false,
    birthTimePrecision: 'branch-range',
    dayBoundaryPolicy: 'midnight',
    relationshipStatus: 'breakup-reunion',
    relationshipDuration: '',
    location: '',
    q1: '',
    q2: '',
    reunionContext: createEmptyLoveReunionContext()
  };
}

export function normalizeLoveReunionContext(source: unknown): LoveReunionContext {
  const value = isRecord(source) ? source : {};

  return {
    version: LOVE_REUNION_CONTEXT_VERSION,
    relationshipState: normalizeSelection(value.relationshipState, LOVE_REUNION_RELATIONSHIP_STATES),
    relationshipLength: normalizeSelection(value.relationshipLength, LOVE_REUNION_RELATIONSHIP_LENGTHS),
    breakupElapsed: normalizeSelection(value.breakupElapsed, LOVE_REUNION_BREAKUP_ELAPSED_OPTIONS),
    lastContactTiming: normalizeSelection(value.lastContactTiming, LOVE_REUNION_LAST_CONTACT_TIMINGS),
    lastContactNote: normalizeText(value.lastContactNote, LOVE_REUNION_TEXT_LIMITS.lastContactNote),
    currentContact: normalizeSelection(value.currentContact, LOVE_REUNION_CURRENT_CONTACT_OPTIONS),
    contactBoundary: normalizeSelection(value.contactBoundary, LOVE_REUNION_CONTACT_BOUNDARIES),
    breakupReason: normalizeSelection(value.breakupReason, LOVE_REUNION_BREAKUP_REASONS),
    breakupReasonDetail: normalizeText(
      value.breakupReasonDetail,
      LOVE_REUNION_TEXT_LIMITS.breakupReasonDetail
    ),
    reunionReason: normalizeText(value.reunionReason, LOVE_REUNION_TEXT_LIMITS.reunionReason),
    partnerBirthKnown: value.partnerBirthKnown === true,
    partnerDataPermissionConfirmed: value.partnerDataPermissionConfirmed === true
  };
}

export function hydrateLoveReunionFormData(source: unknown): LoveReunionFormData {
  const value = isRecord(source) ? source : {};
  const calendar = normalizeAllowed(value.calendar, CALENDARS, 'solar');
  const time = normalizeBirthTimeFields(value);
  const partner = normalizePartner(value.partner);
  const contextSource = isRecord(value.reunionContext) ? value.reunionContext : value;

  return {
    name: normalizeText(value.name, LOVE_REUNION_TEXT_LIMITS.name),
    gender: normalizeAllowed(value.gender, GENDERS, 'female'),
    calendar,
    isLeapMonth: calendar === 'lunar' && value.isLeapMonth === true,
    birthDate: normalizeText(value.birthDate, LOVE_REUNION_TEXT_LIMITS.birthDate),
    ...time,
    dayBoundaryPolicy: normalizeDayBoundaryPolicy(value.dayBoundaryPolicy),
    birthLocation: normalizeBirthLocation(value.birthLocation),
    ...(partner ? { partner } : {}),
    relationshipStatus: 'breakup-reunion',
    relationshipDuration: normalizeAllowed(
      value.relationshipDuration,
      LEGACY_RELATIONSHIP_DURATIONS,
      ''
    ),
    location: normalizeText(value.location, LOVE_REUNION_TEXT_LIMITS.location),
    q1: normalizeText(value.q1, LOVE_REUNION_TEXT_LIMITS.question, false),
    q2: normalizeText(value.q2, LOVE_REUNION_TEXT_LIMITS.question, false),
    reunionContext: normalizeLoveReunionContext(contextSource)
  };
}

export function validateLoveReunionFormData(source: unknown): LoveReunionValidationResult {
  const data = hydrateLoveReunionFormData(source);
  const self = validateBirthInput(data, { subjectLabel: '본인' });
  const errors = self.errors.map((error) => error.message);
  let partner: BirthInputValidationResult | null = null;

  if (data.reunionContext.partnerBirthKnown) {
    if (!data.reunionContext.partnerDataPermissionConfirmed) {
      errors.push('상대방 출생정보를 제공하고 분석에 사용하는 데 필요한 권한을 확인해 주세요.');
    }

    if (!data.partner) {
      errors.push('상대방 생년월일시를 안다고 선택한 경우 상대방 출생 정보를 입력해 주세요.');
    } else {
      partner = validateBirthInput(data.partner, { subjectLabel: '상대방' });
      errors.push(...partner.errors.map((error) => error.message));
    }
  }

  const requiredSelections: Array<[string, string]> = [
    [data.reunionContext.relationshipState, '현재 관계 상태를 선택해 주세요.'],
    [data.reunionContext.relationshipLength, '교제 기간을 선택해 주세요.'],
    [data.reunionContext.breakupElapsed, '이별 후 경과 기간을 선택해 주세요.'],
    [data.reunionContext.lastContactTiming, '마지막 연락 시점을 선택해 주세요.'],
    [data.reunionContext.currentContact, '현재 연락 상태를 선택해 주세요.'],
    [data.reunionContext.contactBoundary, '연락 거절 또는 안전 경계 여부를 선택해 주세요.'],
    [data.reunionContext.breakupReason, '이별 이유를 선택해 주세요.']
  ];

  requiredSelections.forEach(([selection, message]) => {
    if (!selection) {
      errors.push(message);
    }
  });

  if (
    data.reunionContext.currentContact === 'blocked' &&
    data.reunionContext.contactBoundary === 'none'
  ) {
    errors.push('차단·연락 거절 상태에서는 명시적 비접촉 또는 안전 위험 경계를 선택해 주세요.');
  }

  if (
    data.reunionContext.breakupReason === 'other' &&
    !data.reunionContext.breakupReasonDetail.trim()
  ) {
    errors.push('기타 이별 이유를 구체적으로 입력해 주세요.');
  }

  if (!data.reunionContext.reunionReason.trim()) {
    errors.push('재회를 바라는 이유를 입력해 주세요.');
  }

  if (!data.q1.trim()) {
    errors.push('첫 번째 질문을 입력해 주세요.');
  }

  if (!data.q2.trim()) {
    errors.push('두 번째 질문을 입력해 주세요.');
  }

  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)],
    self,
    partner
  };
}

export function prepareLoveReunionCheckoutFormData(source: unknown): LoveReunionFormData {
  const data = hydrateLoveReunionFormData(source);

  return {
    ...data,
    relationshipStatus: 'breakup-reunion',
    relationshipDuration: LOVE_REUNION_RELATIONSHIP_DURATION_MAP[data.reunionContext.relationshipLength],
    partner: data.reunionContext.partnerBirthKnown ? data.partner : undefined,
    q1: data.q1,
    q2: data.q2
  };
}
