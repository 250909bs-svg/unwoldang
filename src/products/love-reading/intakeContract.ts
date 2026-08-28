import { getLoveReactionProfile, type LoveReactionId } from './reactionProfiles';

export const LOVE_READING_RELATIONSHIP_STATUSES = [
  'single',
  'situationship',
  'dating',
  'ambiguous',
  'breakup-reunion',
  'married'
] as const;

export type LoveReadingRelationshipStatus =
  (typeof LOVE_READING_RELATIONSHIP_STATUSES)[number];

export const LOVE_READING_RELATIONSHIP_DURATIONS = [
  'under1',
  'under3',
  'under5',
  'under10'
] as const;

export type LoveReadingRelationshipDuration =
  (typeof LOVE_READING_RELATIONSHIP_DURATIONS)[number];

export const LOVE_READING_FOCUS_VALUES = [
  'partner-type',
  'next-love-timing',
  'my-attraction',
  'repeated-pattern'
] as const;

export type LoveReadingFocus = (typeof LOVE_READING_FOCUS_VALUES)[number];

export type LoveReadingIntakeStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type LoveReadingIntakeValidationField =
  | 'relationshipStatus'
  | 'relationshipDuration'
  | 'loveReaction'
  | 'loveFocus'
  | 'q1'
  | 'q2';

export interface LoveReadingIntakeContextInput {
  readonly relationshipStatus?: unknown;
  readonly relationshipDuration?: unknown;
  readonly loveReaction?: unknown;
  readonly loveFocus?: unknown;
  readonly q1?: unknown;
  readonly q2?: unknown;
}

export interface LoveReadingIntakeValidationError {
  readonly field: LoveReadingIntakeValidationField;
  readonly step: 5 | 6 | 7 | 8;
  readonly message: string;
}

export interface LoveReadingIntakeValidationResult {
  readonly valid: boolean;
  readonly errors: LoveReadingIntakeValidationError[];
}

const RELATIONSHIP_STATUS_SET = new Set<string>(LOVE_READING_RELATIONSHIP_STATUSES);
const RELATIONSHIP_DURATION_SET = new Set<string>(LOVE_READING_RELATIONSHIP_DURATIONS);
const LOVE_FOCUS_SET = new Set<string>(LOVE_READING_FOCUS_VALUES);

function isRelationshipStatus(value: unknown): value is LoveReadingRelationshipStatus {
  return typeof value === 'string' && RELATIONSHIP_STATUS_SET.has(value);
}

function isRelationshipDuration(value: unknown): value is LoveReadingRelationshipDuration {
  return typeof value === 'string' && RELATIONSHIP_DURATION_SET.has(value);
}

function isLoveFocus(value: unknown): value is LoveReadingFocus {
  return typeof value === 'string' && LOVE_FOCUS_SET.has(value);
}

function questionIsReady(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length >= 4;
}

export function isLoveReadingDurationRequired(status: unknown): boolean {
  return status === 'dating' || status === 'married';
}

/** Validates the love-only fields placed on steps 5-8 of the eight-step intake. */
export function validateLoveReadingIntakeContext(
  input: LoveReadingIntakeContextInput
): LoveReadingIntakeValidationResult {
  const errors: LoveReadingIntakeValidationError[] = [];
  const relationshipStatus = input.relationshipStatus;
  const relationshipDuration = input.relationshipDuration;

  if (!isRelationshipStatus(relationshipStatus)) {
    errors.push({
      field: 'relationshipStatus',
      step: 5,
      message: '현재 관계 상태를 선택해 주세요.'
    });
  }

  if (isLoveReadingDurationRequired(relationshipStatus)) {
    if (!isRelationshipDuration(relationshipDuration)) {
      errors.push({
        field: 'relationshipDuration',
        step: 5,
        message: relationshipStatus === 'married'
          ? '결혼 생활 기간을 선택해 주세요.'
          : '연애 기간을 선택해 주세요.'
      });
    }
  } else if (
    relationshipDuration !== undefined &&
    relationshipDuration !== null &&
    relationshipDuration !== '' &&
    !isRelationshipDuration(relationshipDuration)
  ) {
    errors.push({
      field: 'relationshipDuration',
      step: 5,
      message: '관계 기간 선택값을 다시 확인해 주세요.'
    });
  }

  if (!getLoveReactionProfile(input.loveReaction)) {
    errors.push({
      field: 'loveReaction',
      step: 6,
      message: '연락이 늦을 때의 반응을 하나 선택해 주세요.'
    });
  }

  if (!isLoveFocus(input.loveFocus)) {
    errors.push({
      field: 'loveFocus',
      step: 7,
      message: '가장 알고 싶은 연애 주제를 선택해 주세요.'
    });
  }

  if (!questionIsReady(input.q1)) {
    errors.push({
      field: 'q1',
      step: 8,
      message: '첫 번째 질문을 4자 이상 적어 주세요.'
    });
  }

  if (!questionIsReady(input.q2)) {
    errors.push({
      field: 'q2',
      step: 8,
      message: '두 번째 질문을 4자 이상 적어 주세요.'
    });
  }

  return { valid: errors.length === 0, errors };
}

export type { LoveReactionId };
