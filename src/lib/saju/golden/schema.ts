export const goldenFixtureCategories = [
  'solar-general',
  'lunar-regular',
  'lunar-leap',
  'solar-term-boundary',
  'day-boundary',
  'time-uncertainty',
  'timezone-solar-time',
  'dayun-boundary'
] as const;

export type GoldenFixtureCategory = (typeof goldenFixtureCategories)[number];

export const goldenProvenanceTypes = [
  'KASI',
  'approved-independent-manse',
  'independent-standard-table',
  'expert-review',
  'unverified'
] as const;

export type GoldenProvenanceType = (typeof goldenProvenanceTypes)[number];
export type GoldenVerificationStatus = 'verified' | 'partial' | 'pending' | 'conflicting';
export type GoldenFieldVerificationStatus = 'verified' | 'conflicting' | 'pending' | 'not-applicable';
export type GoldenSourceTier = 'A' | 'B' | 'C' | 'D' | 'E';
export type GoldenConfidence = 'high' | 'medium' | 'low' | 'unknown';

export interface GoldenLocationInput {
  label: string;
  latitude?: number;
  longitude?: number;
  utcOffsetMinutes?: number;
}

export interface GoldenFixtureInput {
  calendarType: 'solar' | 'lunar';
  birthDate: string;
  birthTime: string | null;
  birthTimePrecision: 'exact' | 'branch-range' | 'unknown';
  gender: 'male' | 'female';
  leapMonth: boolean;
  timezone: string;
  location: GoldenLocationInput;
  trueSolarTimePolicy: 'disabled' | 'apparent-solar-time';
  lateZiPolicy: 'civil-midnight' | 'late-zi-next-day';
}

export interface GoldenExpectedFacts {
  normalizedSolarDate?: string;
  normalizedLunarDate?: string;
  leapMonth?: boolean;
  yearPillar?: string;
  monthPillar?: string;
  dayPillar?: string;
  hourPillar?: string | null;
  dayMaster?: string;
  dayunDirection?: 'forward' | 'reverse';
  dayunStartsAt?: string;
  firstDayun?: string;
  solarTermBoundaryInstant?: string;
  boundaryRelativeMinutes?: number;
  utcOffsetMinutes?: number;
  normalizedInstant?: string;
  otherFact?: Record<string, string | number | boolean | null>;
}

export type GoldenFactField = keyof GoldenExpectedFacts;

export interface GoldenFactProvenance {
  sourceId?: string;
  sourceTier?: GoldenSourceTier;
  sourceType: GoldenProvenanceType;
  sourceName: string;
  sourceReference: string;
  checkedAt: string;
  checkedBy: string;
  notes: string;
  confidence: GoldenConfidence;
}

export interface GoldenBoundaryReference {
  kind: 'solar-term' | 'civil-day' | 'late-zi' | 'dayun-start';
  label: string;
  referenceInstant?: string;
  relativeMinutes?: number;
  sourceReference?: string;
  status: 'externally-sourced' | 'pending-independent-confirmation';
}

export interface GoldenFixture {
  id: string;
  category: GoldenFixtureCategory;
  description: string;
  input: GoldenFixtureInput;
  expected: GoldenExpectedFacts;
  provenance: Partial<Record<GoldenFactField, GoldenFactProvenance>>;
  targetFields?: GoldenFactField[];
  fieldVerification?: Partial<Record<GoldenFactField, GoldenFieldVerificationStatus>>;
  verificationStatus: GoldenVerificationStatus;
  boundaryReference?: GoldenBoundaryReference;
  comparisonGroup?: string;
  reviewNotes?: string[];
}

export function deriveGoldenFixtureStatus(
  targetFields: GoldenFactField[],
  fieldVerification: Partial<Record<GoldenFactField, GoldenFieldVerificationStatus>>
): GoldenVerificationStatus {
  const statuses = targetFields
    .map((field) => fieldVerification[field] || 'pending')
    .filter((status) => status !== 'not-applicable');
  if (statuses.some((status) => status === 'conflicting')) return 'conflicting';
  if (statuses.length > 0 && statuses.every((status) => status === 'verified')) return 'verified';
  if (statuses.some((status) => status === 'verified')) return 'partial';
  return 'pending';
}

export function hasIndependentProvenance(source: GoldenFactProvenance | undefined) {
  return Boolean(source && source.sourceType !== 'unverified' && source.sourceReference.trim());
}
