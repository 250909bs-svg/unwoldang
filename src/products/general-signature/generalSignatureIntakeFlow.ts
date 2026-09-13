export type GeneralSignatureIntakeStep =
  | 'name'
  | 'birth-date'
  | 'gender'
  | 'birth-time-location'
  | 'relationship'
  | 'question-one'
  | 'question-two';

export const GENERAL_SIGNATURE_INTAKE_STEPS: readonly GeneralSignatureIntakeStep[] = [
  'name',
  'birth-date',
  'gender',
  'birth-time-location',
  'relationship',
  'question-one',
  'question-two'
];

export function parseTypedBirthTime(value: string, finalize = false) {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  const hasExplicitSeparator = value.includes(':');

  // Preserve an unfinished compact entry so `102` can continue to `1024`.
  if (digits.length === 3 && !hasExplicitSeparator && !finalize) {
    return { displayValue: digits, canonicalValue: '' };
  }

  const hourDigits = digits.length === 3 ? digits.slice(0, 1) : digits.slice(0, 2);
  const minuteDigits = digits.length === 3 ? digits.slice(1) : digits.slice(2);
  const displayValue = digits.length > 2 ? `${hourDigits}:${minuteDigits}` : digits;

  if (digits.length < 3) {
    return { displayValue, canonicalValue: '' };
  }

  const hour = Number(hourDigits);
  const minute = Number(minuteDigits);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour > 23 || minute > 59) {
    return { displayValue, canonicalValue: '' };
  }

  const canonicalValue = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  return { displayValue: canonicalValue, canonicalValue };
}

export function getNextGeneralSignatureStep(
  step: GeneralSignatureIntakeStep
): GeneralSignatureIntakeStep | null {
  const currentIndex = GENERAL_SIGNATURE_INTAKE_STEPS.indexOf(step);
  return GENERAL_SIGNATURE_INTAKE_STEPS[currentIndex + 1] ?? null;
}

export function getGeneralSignatureStepProgress(step: GeneralSignatureIntakeStep) {
  const current = Math.max(0, GENERAL_SIGNATURE_INTAKE_STEPS.indexOf(step));
  return {
    current: current + 1,
    total: GENERAL_SIGNATURE_INTAKE_STEPS.length,
    percentage: ((current + 1) / GENERAL_SIGNATURE_INTAKE_STEPS.length) * 100
  };
}
