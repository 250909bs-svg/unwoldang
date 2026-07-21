import type { IntakeFormData } from '../../api/mockData';

const GENERAL_SIGNATURE_PREVIEW_FIXTURE: Partial<IntakeFormData> = {
  name: '개발용 샘플',
  gender: 'female',
  calendar: 'solar',
  isLeapMonth: false,
  birthDate: '1992-09-09',
  birthTime: '10:24',
  isUnknownTime: false,
  birthTimePrecision: 'exact',
  dayBoundaryPolicy: 'midnight',
  relationshipStatus: 'single',
  relationshipDuration: '',
  q1: '직업과 재물 흐름을 함께 볼 때 지금 우선할 선택은 무엇인가요?',
  q2: '앞으로 30일과 90일에 각각 실행할 행동을 알려주세요.'
};

export function getGeneralSignatureDevPreviewFormData(isDevelopment: boolean) {
  return isDevelopment ? { ...GENERAL_SIGNATURE_PREVIEW_FIXTURE } : undefined;
}
