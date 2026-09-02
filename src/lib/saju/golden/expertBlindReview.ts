import type { GoldenFixture } from './schema';

export interface ExpertBlindReviewRow {
  fixtureId: string;
  category: string;
  calendar: string;
  birthDate: string;
  birthTime: string;
  timePrecision: string;
  gender: string;
  timezone: string;
  location: string;
  selectionReason: string;
  expertAStrengthAssessment: string;
  expertASeasonalAssessment: string;
  expertAStructureAssessment: string;
  expertAUsefulElement: string;
  expertAFavorableElements: string;
  expertACautiousElements: string;
  expertAReasoning: string;
  expertAConfidence: string;
  expertBStrengthAssessment: string;
  expertBSeasonalAssessment: string;
  expertBStructureAssessment: string;
  expertBUsefulElement: string;
  expertBFavorableElements: string;
  expertBCautiousElements: string;
  expertBReasoning: string;
  expertBConfidence: string;
  agreementStatus: string;
  conflictingFields: string;
  adjudicationRequired: string;
  finalPolicyDecision: string;
  interpretationPolicyVersion: string;
}

const selectionCounts: Partial<Record<GoldenFixture['category'], number>> = {
  'solar-general': 20,
  'lunar-regular': 8,
  'lunar-leap': 4,
  'solar-term-boundary': 6,
  'day-boundary': 4,
  'time-uncertainty': 4,
  'timezone-solar-time': 2,
  'dayun-boundary': 2
};

export function selectExpertBlindReviewFixtures(fixtures: GoldenFixture[]) {
  return Object.entries(selectionCounts).flatMap(([category, count]) =>
    fixtures
      .filter((fixture) => fixture.category === category && fixture.verificationStatus !== 'conflicting')
      .slice(0, count)
  );
}

export function createExpertBlindReviewRows(fixtures: GoldenFixture[]): ExpertBlindReviewRow[] {
  return selectExpertBlindReviewFixtures(fixtures).map((fixture) => ({
    fixtureId: fixture.id,
    category: fixture.category,
    calendar: fixture.input.calendarType + (fixture.input.leapMonth ? '-leap' : '-regular'),
    birthDate: fixture.input.birthDate,
    birthTime: fixture.input.birthTime || '시간 미상',
    timePrecision: fixture.input.birthTimePrecision,
    gender: fixture.input.gender,
    timezone: fixture.input.timezone,
    location: fixture.input.location.label,
    selectionReason: fixture.category,
    expertAStrengthAssessment: '',
    expertASeasonalAssessment: '',
    expertAStructureAssessment: '',
    expertAUsefulElement: '',
    expertAFavorableElements: '',
    expertACautiousElements: '',
    expertAReasoning: '',
    expertAConfidence: '',
    expertBStrengthAssessment: '',
    expertBSeasonalAssessment: '',
    expertBStructureAssessment: '',
    expertBUsefulElement: '',
    expertBFavorableElements: '',
    expertBCautiousElements: '',
    expertBReasoning: '',
    expertBConfidence: '',
    agreementStatus: '',
    conflictingFields: '',
    adjudicationRequired: '',
    finalPolicyDecision: '',
    interpretationPolicyVersion: ''
  }));
}
