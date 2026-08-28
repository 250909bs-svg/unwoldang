import type { IntakeFormData } from '../../api/mockData';
import { validateBirthInput } from '../../lib/birthInputValidation';
import { normalizeIntakeFormData } from '../../lib/intakeDataContract';
import type { ReportArchiveEntry } from '../../lib/reportArchive';
import {
  GENERAL_SIGNATURE_DRAFT_KEY,
  isGeneralSignatureQuestionReady
} from './generalSignatureIntakeContract';

export function isRecoverableGeneralSignatureInput(
  value?: Partial<IntakeFormData> | null
): value is Partial<IntakeFormData> {
  const normalized = normalizeIntakeFormData(value);
  return Boolean(
    normalized.name?.trim() &&
    (normalized.gender === 'male' || normalized.gender === 'female') &&
    normalized.birthDate &&
    validateBirthInput(normalized, { subjectLabel: '본인' }).valid &&
    normalized.relationshipStatus &&
    normalized.relationshipDuration &&
    isGeneralSignatureQuestionReady(normalized.q1 || '') &&
    isGeneralSignatureQuestionReady(normalized.q2 || '')
  );
}

export function parseGeneralSignatureDraft(raw: string | null | undefined) {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<IntakeFormData>;
    return isRecoverableGeneralSignatureInput(parsed)
      ? normalizeIntakeFormData(parsed)
      : null;
  } catch {
    return null;
  }
}

export function readGeneralSignatureDraft(storage?: Pick<Storage, 'getItem'> | null) {
  return parseGeneralSignatureDraft(storage?.getItem(GENERAL_SIGNATURE_DRAFT_KEY));
}

export function selectLatestGeneralSignatureArchive(entries: readonly ReportArchiveEntry[]) {
  return entries
    .filter((entry) => entry.productId === 'general-signature')
    .sort((left, right) => Date.parse(right.createdAt || '') - Date.parse(left.createdAt || ''))[0] || null;
}
