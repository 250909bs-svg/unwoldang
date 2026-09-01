import type { IntakeFormData } from '../../api/mockData';

export const GENERAL_SIGNATURE_DRAFT_KEY = 'unwoldang.intake.general-signature';

const GENERAL_SIGNATURE_QUESTION_MIN_LENGTH = 15;

export function isGeneralSignatureQuestionReady(value: string) {
  return value.trim().length >= GENERAL_SIGNATURE_QUESTION_MIN_LENGTH;
}

export function isGeneralSignatureGenderSelected(gender?: IntakeFormData['gender']) {
  return gender === 'male' || gender === 'female';
}

export function isGeneralSignatureRelationshipReady(
  status?: IntakeFormData['relationshipStatus'],
  duration?: IntakeFormData['relationshipDuration']
) {
  return Boolean(status && duration);
}
