import {
  REUNION_CONTEXT_VERSION,
  reunionBreakupDurationValues,
  reunionContactStatusValues,
  reunionDesiredOutcomeValues,
  type ReunionContext,
  type ReunionContextInput,
  type ReunionValidationError,
  type ReunionValidationResult
} from './types';

const BREAKUP_REASON_MAX_LENGTH = 500;
const NOTES_MAX_LENGTH = 1_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAllowed<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

function normalizeText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function isCalendarDate(value: string) {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function createEmptyReunionContext(): ReunionContext {
  return {
    schemaVersion: REUNION_CONTEXT_VERSION,
    breakupDuration: 'unknown',
    contactStatus: 'unknown',
    breakupReason: '',
    desiredOutcome: 'unsure',
    notes: '',
    consentToUsePartnerData: false
  };
}

/** Safely canonicalizes draft/API input without inventing missing relationship facts. */
export function normalizeReunionContext(value: ReunionContextInput): ReunionContext;
export function normalizeReunionContext(value: unknown): ReunionContext | null;
export function normalizeReunionContext(value: unknown): ReunionContext | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== undefined && value.schemaVersion !== REUNION_CONTEXT_VERSION) return null;

  const fallback = createEmptyReunionContext();
  const lastContactAt = normalizeText(value.lastContactAt, 10);
  return {
    schemaVersion: REUNION_CONTEXT_VERSION,
    breakupDuration: isAllowed(value.breakupDuration, reunionBreakupDurationValues) ? value.breakupDuration : fallback.breakupDuration,
    contactStatus: isAllowed(value.contactStatus, reunionContactStatusValues) ? value.contactStatus : fallback.contactStatus,
    ...(lastContactAt ? { lastContactAt } : {}),
    breakupReason: normalizeText(value.breakupReason, BREAKUP_REASON_MAX_LENGTH),
    desiredOutcome: isAllowed(value.desiredOutcome, reunionDesiredOutcomeValues) ? value.desiredOutcome : fallback.desiredOutcome,
    notes: normalizeText(value.notes, NOTES_MAX_LENGTH),
    consentToUsePartnerData: value.consentToUsePartnerData === true
  };
}

export function validateReunionContext(value: unknown): ReunionValidationResult {
  const errors: ReunionValidationError[] = [];
  if (!isRecord(value)) {
    return { valid: false, errors: [{ field: 'context', message: '재회 정보를 확인해 주세요.' }] };
  }

  if (value.schemaVersion !== undefined && value.schemaVersion !== REUNION_CONTEXT_VERSION) {
    errors.push({ field: 'schemaVersion', message: '지원하지 않는 재회 정보 버전입니다.' });
  }
  if (!isAllowed(value.breakupDuration, reunionBreakupDurationValues)) {
    errors.push({ field: 'breakupDuration', message: '이별 후 기간을 선택해 주세요.' });
  }
  if (!isAllowed(value.contactStatus, reunionContactStatusValues)) {
    errors.push({ field: 'contactStatus', message: '현재 연락 상태를 선택해 주세요.' });
  }
  if (value.lastContactAt !== undefined && (typeof value.lastContactAt !== 'string' || !isCalendarDate(value.lastContactAt.trim()))) {
    errors.push({ field: 'lastContactAt', message: '마지막 연락일을 올바른 날짜로 입력해 주세요.' });
  }

  const breakupReason = typeof value.breakupReason === 'string' ? value.breakupReason.trim() : '';
  if (!breakupReason) {
    errors.push({ field: 'breakupReason', message: '이별 배경을 입력해 주세요.' });
  } else if (breakupReason.length > BREAKUP_REASON_MAX_LENGTH) {
    errors.push({ field: 'breakupReason', message: '이별 배경은 500자 이내로 입력해 주세요.' });
  }

  if (!isAllowed(value.desiredOutcome, reunionDesiredOutcomeValues)) {
    errors.push({ field: 'desiredOutcome', message: '원하는 결과를 선택해 주세요.' });
  }
  if (value.notes !== undefined && (typeof value.notes !== 'string' || value.notes.trim().length > NOTES_MAX_LENGTH)) {
    errors.push({ field: 'notes', message: '추가 내용은 1,000자 이내로 입력해 주세요.' });
  }
  if (value.consentToUsePartnerData !== true) {
    errors.push({ field: 'consentToUsePartnerData', message: '상대방 출생 정보를 이 리포트에 사용하는 데 동의해 주세요.' });
  }

  return { valid: errors.length === 0, errors };
}
