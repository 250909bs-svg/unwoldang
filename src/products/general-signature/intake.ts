import type { IntakeFormData } from '../../api/mockData';
import { isRelationshipDurationRequired } from '../../lib/relationshipIntake';
import { GENERAL_SIGNATURE_ID, GENERAL_SIGNATURE_PRODUCT } from './product';

const DATE_DIGITS = /^\d{8}$/;

export function formatGeneralSignatureBirthDate(
  value: string,
  calendar: IntakeFormData['calendar']
) {
  const digits = value.replace(/\D/g, '').slice(0, 8);

  if (!DATE_DIGITS.test(digits)) {
    return '';
  }

  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const normalized = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;

  if (year < 1000 || year > 9999 || month < 1 || month > 12) {
    return '';
  }

  if (calendar === 'lunar') {
    return day >= 1 && day <= 30 ? normalized : '';
  }

  const probe = new Date(Date.UTC(year, month - 1, day));
  const validSolarDate =
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day;

  return validSolarDate ? normalized : '';
}

export type GeneralSignatureInputPolicySummary = {
  calendar: string;
  birthTime: string;
  dayBoundary: string;
  solarTime: string;
};

export function getGeneralSignatureInputPolicySummary(
  formData: Partial<IntakeFormData>
): GeneralSignatureInputPolicySummary {
  const calendar = formData.calendar === 'lunar'
    ? formData.isLeapMonth
      ? '음력 · 윤달'
      : '음력 · 평달'
    : '양력';
  const birthTime = formData.isUnknownTime
    ? '시간 미상 · 시주 단정 안 함'
    : !formData.birthTime
      ? '출생 시각 선택 필요'
      : formData.birthTimePrecision === 'exact'
        ? `정확 시각 · ${formData.birthTime}`
        : `시간대 비교 · ${formData.birthTime}`;
  const dayBoundary = formData.dayBoundaryPolicy === 'late-zi'
    ? formData.birthLocation?.applySolarTimeCorrection
      ? '야자시 · 진태양시 보정 후 23:00~23:59 익일'
      : '야자시 · 입력 시각 23:00~23:59 익일'
    : '자정 · 00시 날짜 변경 기준';
  const solarTime = formData.birthLocation?.applySolarTimeCorrection
    ? `${formData.birthLocation.label} · 진태양시 보정 요청`
    : '출생지 보정 안 함 · 한국 표준시';

  return { calendar, birthTime, dayBoundary, solarTime };
}

export function normalizeGeneralSignatureBirthFields(
  source: Partial<IntakeFormData>
): Partial<IntakeFormData> {
  const isUnknownTime = Boolean(source.isUnknownTime);
  const birthTime = isUnknownTime ? '' : source.birthTime || '';
  const birthTimePrecision = isUnknownTime
    ? 'unknown'
    : /^\d{1,2}:\d{2}$/.test(birthTime)
      ? 'exact'
      : 'branch-range';

  return {
    ...source,
    calendar: source.calendar === 'lunar' ? 'lunar' : 'solar',
    isLeapMonth: source.calendar === 'lunar' && Boolean(source.isLeapMonth),
    birthTime,
    isUnknownTime,
    birthTimePrecision,
    dayBoundaryPolicy: source.dayBoundaryPolicy === 'late-zi' ? 'late-zi' : 'midnight'
  };
}

export function applyGeneralSignatureCalendarSelection(
  current: IntakeFormData,
  dateDigits: string,
  calendar: IntakeFormData['calendar']
): IntakeFormData {
  return {
    ...current,
    calendar,
    isLeapMonth: calendar === 'lunar' && current.isLeapMonth,
    birthDate: formatGeneralSignatureBirthDate(dateDigits, calendar)
  };
}

export function isGeneralSignatureRelationshipReady(formData: Partial<IntakeFormData>) {
  if (!formData.relationshipStatus) {
    return false;
  }

  return !isRelationshipDurationRequired(formData.relationshipStatus) || Boolean(formData.relationshipDuration);
}

export function resolveGeneralSignatureIntakeConfig(productId?: string) {
  return productId === GENERAL_SIGNATURE_ID ? GENERAL_SIGNATURE_PRODUCT.intake : null;
}
