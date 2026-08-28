export const GENERAL_SIGNATURE_DRAFT_KEY = 'unwoldang.intake.general-signature';

const GENERAL_SIGNATURE_QUESTION_MIN_LENGTH = 15;

export function isGeneralSignatureQuestionReady(value: string) {
  return value.trim().length >= GENERAL_SIGNATURE_QUESTION_MIN_LENGTH;
}
