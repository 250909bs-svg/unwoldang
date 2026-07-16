import type {
  BirthTimePrecision,
  DayBoundaryPolicy,
  IntakeFormData,
  PartnerBirthData
} from '../api/mockData';
import {
  buildBirthCalculation,
  type BirthCalculationResult,
  type BirthContextOptions
} from './saju/v2/calendar';

export type BirthInputValidationField =
  | 'name'
  | 'gender'
  | 'calendar'
  | 'isLeapMonth'
  | 'birthDate'
  | 'birthTime'
  | 'birthTimePrecision'
  | 'dayBoundaryPolicy'
  | 'birthLocation'
  | 'partner';

export type BirthInputValidationCode =
  | 'required'
  | 'invalid_value'
  | 'leap_month_requires_lunar'
  | 'time_precision_mismatch'
  | 'calendar_preflight_failed'
  | 'partner_required';

export interface BirthInputValidationError {
  code: BirthInputValidationCode;
  field: BirthInputValidationField;
  message: string;
}

export interface BirthInputValidationResult {
  valid: boolean;
  errors: BirthInputValidationError[];
  calculation: BirthCalculationResult | null;
  normalizedPrecision: BirthTimePrecision;
  normalizedDayBoundaryPolicy: DayBoundaryPolicy;
}

export interface IntakeBirthValidationResult {
  valid: boolean;
  self: BirthInputValidationResult;
  partner: BirthInputValidationResult | null;
  errors: BirthInputValidationError[];
}

type BirthInput = Partial<PartnerBirthData> & Pick<Partial<IntakeFormData>, 'location'>;

const EXACT_TIME = /^(?:[01]?\d|2[0-3]):[0-5]\d$/;
const RANGE_TIME = /(?:[01]?\d|2[0-3]):[0-5]\d\s*(?:-|–|—|~|～)\s*(?:[01]?\d|2[0-3]):[0-5]\d/;

function inferPrecision(input: BirthInput): BirthTimePrecision {
  if (input.isUnknownTime) return 'unknown';

  const birthTime = input.birthTime?.trim() || '';
  if (EXACT_TIME.test(birthTime)) return 'exact';
  if (RANGE_TIME.test(birthTime)) return 'branch-range';
  return input.birthTimePrecision === 'unknown' ? 'unknown' : input.birthTimePrecision || 'branch-range';
}

function calendarOptionsFor(input: BirthInput): BirthContextOptions {
  const location = input.birthLocation;
  const offset = location?.utcOffsetMinutes ?? (location?.timezone === 'Asia/Seoul' ? 540 : undefined);

  return {
    timezoneId: location?.timezone || 'Asia/Seoul',
    utcOffsetMinutes: offset,
    latitude: location?.latitude,
    longitude: location?.longitude,
    locationLabel: location?.label || input.location,
    applyTrueSolarTime: Boolean(
      location?.applySolarTimeCorrection && location.longitude !== undefined
    ),
    includeEquationOfTime: true,
    dayBoundaryPolicy: input.dayBoundaryPolicy === 'late-zi'
      ? 'late-zi-next-day'
      : 'civil-midnight'
  };
}

function preflightMessage(error: unknown, subjectLabel: string) {
  const raw = error instanceof Error ? error.message : String(error);

  if (/Invalid leap month/i.test(raw)) {
    return `${subjectLabel}의 선택한 연도와 월에는 윤달이 없습니다.`;
  }

  if (/Lunar date out of supported range/i.test(raw)) {
    return `${subjectLabel}의 음력 생년월일이 계산 지원 범위를 벗어났습니다.`;
  }

  return `${subjectLabel}의 출생 정보를 계산할 수 없습니다. ${raw}`;
}

/**
 * Validates one person's birth input and runs the production calendar-v2
 * calculation as a preflight. A form is commercially ready only when this
 * function returns `valid: true`; UI shape checks alone are insufficient.
 */
export function validateBirthInput(
  input: BirthInput,
  options: { subjectLabel?: string } = {}
): BirthInputValidationResult {
  const subjectLabel = options.subjectLabel || '본인';
  const errors: BirthInputValidationError[] = [];
  const birthTime = input.birthTime?.trim() || '';
  const normalizedPrecision = inferPrecision(input);
  const normalizedDayBoundaryPolicy = input.dayBoundaryPolicy === 'late-zi' ? 'late-zi' : 'midnight';

  if (!input.name?.trim()) {
    errors.push({ code: 'required', field: 'name', message: `${subjectLabel}의 이름 또는 호칭을 입력해 주세요.` });
  }

  if (input.gender !== 'male' && input.gender !== 'female') {
    errors.push({ code: 'invalid_value', field: 'gender', message: `${subjectLabel}의 성별을 확인해 주세요.` });
  }

  if (input.calendar !== 'solar' && input.calendar !== 'lunar') {
    errors.push({ code: 'invalid_value', field: 'calendar', message: `${subjectLabel}의 양력·음력 기준을 선택해 주세요.` });
  }

  if (input.calendar === 'solar' && input.isLeapMonth) {
    errors.push({
      code: 'leap_month_requires_lunar',
      field: 'isLeapMonth',
      message: `${subjectLabel}의 윤달은 음력에서만 선택할 수 있습니다.`
    });
  }

  if (!input.birthDate?.trim()) {
    errors.push({ code: 'required', field: 'birthDate', message: `${subjectLabel}의 생년월일을 입력해 주세요.` });
  }

  if (input.dayBoundaryPolicy !== undefined && input.dayBoundaryPolicy !== 'midnight' && input.dayBoundaryPolicy !== 'late-zi') {
    errors.push({
      code: 'invalid_value',
      field: 'dayBoundaryPolicy',
      message: `${subjectLabel}의 23시대 날짜 경계 기준을 다시 선택해 주세요.`
    });
  }

  if (
    input.birthTimePrecision !== undefined &&
    input.birthTimePrecision !== 'exact' &&
    input.birthTimePrecision !== 'branch-range' &&
    input.birthTimePrecision !== 'unknown'
  ) {
    errors.push({
      code: 'invalid_value',
      field: 'birthTimePrecision',
      message: `${subjectLabel}의 출생 시각 정밀도 값이 올바르지 않습니다.`
    });
  }

  if (input.isUnknownTime) {
    if (birthTime) {
      errors.push({
        code: 'time_precision_mismatch',
        field: 'birthTime',
        message: `${subjectLabel}의 '시간 모름' 선택과 입력된 출생 시각이 서로 충돌합니다.`
      });
    }
    if (input.birthTimePrecision !== undefined && input.birthTimePrecision !== 'unknown') {
      errors.push({
        code: 'time_precision_mismatch',
        field: 'birthTimePrecision',
        message: `${subjectLabel}의 '시간 모름' 선택과 시각 정밀도가 서로 다릅니다.`
      });
    }
  } else if (!birthTime) {
    errors.push({ code: 'required', field: 'birthTime', message: `${subjectLabel}의 출생 시각 또는 '시간 모름'을 선택해 주세요.` });
  } else {
    const parsedPrecision = EXACT_TIME.test(birthTime)
      ? 'exact'
      : RANGE_TIME.test(birthTime)
        ? 'branch-range'
        : null;

    if (input.birthTimePrecision === 'unknown') {
      errors.push({
        code: 'time_precision_mismatch',
        field: 'birthTimePrecision',
        message: `${subjectLabel}의 출생 시각이 있는데 정밀도가 '시간 모름'으로 저장되어 있습니다.`
      });
    } else if (!parsedPrecision) {
      errors.push({
        code: 'invalid_value',
        field: 'birthTime',
        message: `${subjectLabel}의 출생 시각은 HH:mm 또는 제공된 2시간대 형식이어야 합니다.`
      });
    } else if (parsedPrecision && input.birthTimePrecision && parsedPrecision !== input.birthTimePrecision) {
      errors.push({
        code: 'time_precision_mismatch',
        field: 'birthTimePrecision',
        message: `${subjectLabel}의 출생 시각 형식과 시각 정밀도가 서로 다릅니다.`
      });
    }
  }

  let calculation: BirthCalculationResult | null = null;
  const hasBlockingShapeError = errors.some((error) =>
    error.field === 'calendar' ||
    error.field === 'isLeapMonth' ||
    error.field === 'birthDate' ||
    error.field === 'birthTime' ||
    error.field === 'birthTimePrecision' ||
    error.field === 'dayBoundaryPolicy'
  );

  if (!hasBlockingShapeError) {
    try {
      calculation = buildBirthCalculation(input as Partial<IntakeFormData>, calendarOptionsFor(input));
    } catch (error) {
      errors.push({
        code: 'calendar_preflight_failed',
        field: 'birthDate',
        message: preflightMessage(error, subjectLabel)
      });
    }
  }

  return {
    valid: errors.length === 0 && calculation !== null,
    errors,
    calculation,
    normalizedPrecision,
    normalizedDayBoundaryPolicy
  };
}

/** Validates the purchaser and, when required, the compatibility partner. */
export function validateIntakeBirthInputs(
  formData: Partial<IntakeFormData>,
  options: { requirePartner?: boolean } = {}
): IntakeBirthValidationResult {
  const self = validateBirthInput(formData, { subjectLabel: '본인' });
  let partner: BirthInputValidationResult | null = null;

  if (options.requirePartner) {
    partner = formData.partner
      ? validateBirthInput(formData.partner, { subjectLabel: '상대방' })
      : {
          valid: false,
          errors: [{ code: 'partner_required', field: 'partner', message: '정밀 궁합을 위해 상대방의 출생 정보를 입력해 주세요.' }],
          calculation: null,
          normalizedPrecision: 'branch-range',
          normalizedDayBoundaryPolicy: 'midnight'
        };
  }

  const errors = [...self.errors, ...(partner?.errors || [])];
  return {
    valid: self.valid && (!options.requirePartner || Boolean(partner?.valid)),
    self,
    partner,
    errors
  };
}
