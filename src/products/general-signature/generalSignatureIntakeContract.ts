import type { IntakeFormData } from '../../api/mockData';
import type { ReleasePreflightStatus } from '../../lib/releasePreflightContract';

export const GENERAL_SIGNATURE_DRAFT_KEY = 'unwoldang.intake.general-signature';

export const GENERAL_SIGNATURE_QUESTION_MIN_LENGTH = 15;

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

export function canContinueManualReviewInLocalPreview(
  status: ReleasePreflightStatus,
  runtime: { isDevelopment: boolean; hostname: string }
) {
  if (status !== 'manual-review-required' || !runtime.isDevelopment) {
    return false;
  }

  return runtime.hostname === '127.0.0.1' || runtime.hostname === 'localhost';
}
