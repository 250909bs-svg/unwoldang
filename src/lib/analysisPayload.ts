import { findServiceById, type IntakeFormData, type ServiceId } from '../api/mockData';

export interface AnalysisRequestPayload {
  serviceId: ServiceId;
  serviceLabel: string;
  timezone: string;
  user: {
    name: string;
    gender: 'male' | 'female';
  };
  birth: {
    calendar: 'solar' | 'lunar';
    isLeapMonth: boolean;
    date: string;
    time: string | null;
    isUnknownTime: boolean;
  };
  relationship: {
    status: IntakeFormData['relationshipStatus'] | null;
    duration: IntakeFormData['relationshipDuration'] | null;
    summary: string;
  };
  questions: string[];
}

function getRelationshipStatusLabel(status?: IntakeFormData['relationshipStatus']) {
  switch (status) {
    case 'dating':
      return '연애중';
    case 'single':
      return '솔로';
    case 'married':
      return '기혼';
    default:
      return '미입력';
  }
}

function getRelationshipDurationLabel(duration?: IntakeFormData['relationshipDuration']) {
  switch (duration) {
    case 'under1':
      return '1년 미만';
    case 'under3':
      return '3년 미만';
    case 'under5':
      return '5년 미만';
    case 'under10':
      return '10년 미만';
    default:
      return '';
  }
}

export function buildAnalysisRequestPayload(serviceId: ServiceId, formData: Partial<IntakeFormData>): AnalysisRequestPayload {
  const service = findServiceById(serviceId);
  const statusLabel = getRelationshipStatusLabel(formData.relationshipStatus);
  const durationLabel = getRelationshipDurationLabel(formData.relationshipDuration);
  const relationshipSummary = durationLabel ? `${statusLabel} / ${durationLabel}` : statusLabel;

  return {
    serviceId,
    serviceLabel: service.label,
    timezone: 'Asia/Seoul',
    user: {
      name: formData.name || '',
      gender: formData.gender || 'female'
    },
    birth: {
      calendar: formData.calendar || 'solar',
      isLeapMonth: Boolean(formData.isLeapMonth),
      date: formData.birthDate || '',
      time: formData.isUnknownTime ? null : formData.birthTime || null,
      isUnknownTime: Boolean(formData.isUnknownTime)
    },
    relationship: {
      status: formData.relationshipStatus || null,
      duration: formData.relationshipDuration || null,
      summary: relationshipSummary
    },
    questions: [formData.q1, formData.q2].filter((question): question is string => Boolean(question?.trim()))
  };
}
