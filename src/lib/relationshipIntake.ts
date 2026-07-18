import type { IntakeFormData } from '../api/mockData';

type NonEmptyRelationshipStatus = Exclude<IntakeFormData['relationshipStatus'], ''>;

export const RELATIONSHIP_STATUS_LABELS: Readonly<Record<NonEmptyRelationshipStatus, string>> = {
  single: '솔로',
  situationship: '썸 타는 중',
  dating: '연애 중',
  ambiguous: '관계가 애매함',
  'breakup-reunion': '이별·재회 고민',
  married: '기혼'
};

export function getRelationshipStatusLabel(status?: IntakeFormData['relationshipStatus']) {
  return status ? RELATIONSHIP_STATUS_LABELS[status] : '관계 상태 미입력';
}

export function getRelationshipDurationLabel(duration?: IntakeFormData['relationshipDuration']) {
  switch (duration) {
    case 'under1':
      return '1년 미만';
    case 'under3':
      return '1년 이상 3년 이하';
    case 'under5':
      return '3년 이상 5년 이하';
    case 'under10':
      return '5년 이상 10년 이하';
    default:
      return '';
  }
}

export function isRelationshipDurationRequired(status?: IntakeFormData['relationshipStatus']) {
  return status === 'dating' || status === 'married';
}
