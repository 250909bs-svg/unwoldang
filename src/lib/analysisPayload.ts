import {
  findServiceById,
  type BirthLocationData,
  type IntakeFormData,
  type PartnerBirthData,
  type ServiceId
} from '../api/mockData';
import { normalizeLoveFocus } from './loveFocus';
import { normalizeLoveReaction } from './mz-love-fact/microChoice';
import type { ReunionContext } from './reunion/types';
import { getRelationshipDurationLabel, getRelationshipStatusLabel } from './relationshipIntake';

export interface PastLifeAnalysisContext {
  topic: string;
  repeatedScene: string;
  frequentEmotion: string;
  hiddenDesire: string;
  chosenSymbol: string;
  readingTone: string;
}

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
    precision: IntakeFormData['birthTimePrecision'];
    dayBoundaryPolicy: IntakeFormData['dayBoundaryPolicy'];
    location: BirthLocationData | null;
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
  reunion: ReunionContext | null;
  questions: string[];
}

export function buildAnalysisRequestPayload(
  serviceId: ServiceId,
  formData: Partial<IntakeFormData> & { reunion?: ReunionContext }
): AnalysisRequestPayload {
  const service = findServiceById(serviceId);
  const statusLabel = getRelationshipStatusLabel(formData.relationshipStatus);
  const durationLabel = getRelationshipDurationLabel(formData.relationshipDuration);
  const relationshipSummary = durationLabel ? `${statusLabel} / ${durationLabel}` : statusLabel;
  const partner = formData.partner
    ? {
        ...formData.partner,
        name: formData.partner.name.trim(),
        birthDate: formData.partner.birthDate.trim(),
        birthTime: formData.partner.isUnknownTime ? '' : formData.partner.birthTime.trim(),
        birthTimePrecision:
          formData.partner.birthTimePrecision ||
          (formData.partner.isUnknownTime
            ? 'unknown'
            : /^\d{1,2}:\d{2}$/.test(formData.partner.birthTime)
              ? 'exact'
              : 'branch-range'),
        dayBoundaryPolicy: formData.partner.dayBoundaryPolicy || 'midnight'
      }
    : null;

  return {
    serviceId,
    serviceLabel: service.label,
    timezone: formData.birthLocation?.timezone || 'Asia/Seoul',
    user: {
      name: formData.name?.trim() || '',
      gender: formData.gender || 'female'
    },
    birth: {
      calendar: formData.calendar || 'solar',
      isLeapMonth: Boolean(formData.isLeapMonth),
      date: formData.birthDate || '',
      time: formData.isUnknownTime ? null : formData.birthTime || null,
      isUnknownTime: Boolean(formData.isUnknownTime),
      precision:
        formData.birthTimePrecision ||
        (formData.isUnknownTime
          ? 'unknown'
          : /^\d{1,2}:\d{2}$/.test(formData.birthTime || '')
            ? 'exact'
            : 'branch-range'),
      dayBoundaryPolicy: formData.dayBoundaryPolicy || 'midnight',
      location: formData.birthLocation || null
    },
    partner,
    relationship: {
      status: formData.relationshipStatus || null,
      duration: formData.relationshipDuration || null,
      microChoice: normalizeLoveReaction(formData.loveReaction),
      focus: normalizeLoveFocus(formData.loveFocus),
      summary: relationshipSummary
    },
    pastLifeContext:
      serviceId === 'past-life-goblin'
        ? {
            topic: formData.pastLifeTopic?.trim() || '',
            repeatedScene: formData.repeatedScene?.trim() || '',
            frequentEmotion: formData.frequentEmotion?.trim() || '',
            hiddenDesire: formData.hiddenDesire?.trim() || '',
            chosenSymbol: formData.chosenSymbol?.trim() || '',
            readingTone: formData.readingTone?.trim() || ''
          }
        : null,
    reunion: serviceId === 'love-reunion' ? formData.reunion ?? null : null,
    questions: [formData.q1, formData.q2]
      .filter((question): question is string => Boolean(question?.trim()))
      .map((question) => question.trim())
  };
}
