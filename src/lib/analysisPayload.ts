import {
  findServiceById,
  type BirthLocationData,
  type IntakeFormData,
  type PartnerBirthData,
  type ServiceId
} from '../api/mockData';
import { INTAKE_DATA_CONTRACT_VERSION, normalizeIntakeFormData } from './intakeDataContract';
import { normalizeLoveFocus } from './loveFocus';
import { normalizeLoveReaction } from './mz-love-fact/microChoice';
import { getRelationshipSummary } from './relationshipIntake';

export interface PastLifeAnalysisContext {
  topic: string;
  repeatedScene: string;
  frequentEmotion: string;
  hiddenDesire: string;
  chosenSymbol: string;
  readingTone: string;
}

export interface AnalysisRequestPayload {
  contractVersion: typeof INTAKE_DATA_CONTRACT_VERSION;
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
    precision: IntakeFormData['birthTimePrecision'];
    dayBoundaryPolicy: IntakeFormData['dayBoundaryPolicy'];
    location: BirthLocationData | null;
    locationText: string;
  };
  partner: PartnerBirthData | null;
  relationship: {
    status: IntakeFormData['relationshipStatus'] | null;
    duration: IntakeFormData['relationshipDuration'] | null;
    microChoice: IntakeFormData['loveReaction'] | null;
    focus: IntakeFormData['loveFocus'] | null;
    summary: string;
  };
  pastLifeContext: PastLifeAnalysisContext | null;
  questions: string[];
}

export function buildAnalysisRequestPayload(serviceId: ServiceId, formData: Partial<IntakeFormData>): AnalysisRequestPayload {
  const normalized = normalizeIntakeFormData(formData);
  const service = findServiceById(serviceId);
  const relationshipSummary = getRelationshipSummary(normalized);
  const partner = normalized.partner
    ? {
        ...normalized.partner,
        name: normalized.partner.name.trim()
      }
    : null;

  return {
    contractVersion: INTAKE_DATA_CONTRACT_VERSION,
    serviceId,
    serviceLabel: service.label,
    timezone: normalized.birthLocation?.timezone || normalized.timezone || 'Asia/Seoul',
    user: {
      name: normalized.name?.trim() || '',
      gender: normalized.gender || 'female'
    },
    birth: {
      calendar: normalized.calendar || 'solar',
      isLeapMonth: Boolean(normalized.isLeapMonth),
      date: normalized.birthDate || '',
      time: normalized.isUnknownTime ? null : normalized.birthTime || null,
      isUnknownTime: Boolean(normalized.isUnknownTime),
      precision: normalized.birthTimePrecision,
      dayBoundaryPolicy: normalized.dayBoundaryPolicy,
      location: normalized.birthLocation || null,
      locationText: normalized.location || ''
    },
    partner,
    relationship: {
      status: normalized.relationshipStatus || null,
      duration: normalized.relationshipStatus === 'single' ? null : normalized.relationshipDuration || null,
      microChoice: normalizeLoveReaction(normalized.loveReaction),
      focus: normalizeLoveFocus(normalized.loveFocus),
      summary: relationshipSummary
    },
    pastLifeContext:
      serviceId === 'past-life-goblin'
        ? {
            topic: normalized.pastLifeTopic?.trim() || '',
            repeatedScene: normalized.repeatedScene?.trim() || '',
            frequentEmotion: normalized.frequentEmotion?.trim() || '',
            hiddenDesire: normalized.hiddenDesire?.trim() || '',
            chosenSymbol: normalized.chosenSymbol?.trim() || '',
            readingTone: normalized.readingTone?.trim() || ''
          }
        : null,
    questions: [normalized.q1, normalized.q2]
      .filter((question): question is string => Boolean(question?.trim()))
      .map((question) => question.trim())
  };
}
