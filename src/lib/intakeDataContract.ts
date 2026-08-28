import type {
  BirthLocationData,
  BirthTimePrecision,
  IntakeFormData,
  PartnerBirthData
} from '../api/mockData';

export const INTAKE_DATA_CONTRACT_VERSION = 'unwoldang-intake-v2' as const;

const EXACT_TIME = /^(?:[01]?\d|2[0-3]):[0-5]\d$/;
const RANGE_TIME = /(?:[01]?\d|2[0-3]):[0-5]\d\s*(?:-|–|—|~|～)\s*(?:[01]?\d|2[0-3]):[0-5]\d/;

type TimeInput = Pick<IntakeFormData, 'birthTime' | 'isUnknownTime' | 'birthTimePrecision'>;

export function resolveBirthTimePrecision(input: Partial<TimeInput>): BirthTimePrecision {
  if (input.isUnknownTime) return 'unknown';

  const birthTime = input.birthTime?.trim() || '';
  if (EXACT_TIME.test(birthTime)) return 'exact';
  if (RANGE_TIME.test(birthTime)) return 'branch-range';
  return input.birthTimePrecision === 'unknown' ? 'branch-range' : input.birthTimePrecision || 'branch-range';
}

function normalizeExactTime(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : value;
}

function normalizeLocation(source: Partial<IntakeFormData>): BirthLocationData | undefined {
  const existing = source.birthLocation;
  const label = existing?.label?.trim() || source.location?.trim() || '';
  const latitude = existing?.latitude ?? source.latitude;
  const longitude = existing?.longitude ?? source.longitude;
  const timezone = existing?.timezone?.trim() || source.timezone?.trim() || undefined;
  const utcOffsetMinutes = existing?.utcOffsetMinutes ?? source.utcOffsetMinutes;
  const applySolarTimeCorrection =
    existing?.applySolarTimeCorrection ?? source.applySolarTimeCorrection;

  if (!label && latitude === undefined && longitude === undefined && !timezone && utcOffsetMinutes === undefined) {
    return undefined;
  }

  return {
    label,
    latitude,
    longitude,
    timezone,
    utcOffsetMinutes,
    applySolarTimeCorrection
  };
}

function normalizePartner(partner?: PartnerBirthData): PartnerBirthData | undefined {
  if (!partner) return undefined;

  const precision = resolveBirthTimePrecision(partner);
  const birthTime = precision === 'unknown'
    ? ''
    : precision === 'exact'
      ? normalizeExactTime(partner.birthTime.trim())
      : partner.birthTime.trim();

  return {
    ...partner,
    name: partner.name,
    birthDate: partner.birthDate.trim(),
    birthTime,
    isUnknownTime: precision === 'unknown',
    birthTimePrecision: precision,
    dayBoundaryPolicy: partner.dayBoundaryPolicy === 'late-zi' ? 'late-zi' : 'midnight'
  };
}

/**
 * Canonicalizes every field that crosses login, payment redirect, report generation,
 * and archive boundaries. It never supplies sample identity or birth values.
 */
export function normalizeIntakeFormData(
  source?: Partial<IntakeFormData> | null
): Partial<IntakeFormData> {
  if (!source) return {};

  const precision = resolveBirthTimePrecision(source);
  const birthTime = precision === 'unknown'
    ? ''
    : precision === 'exact'
      ? normalizeExactTime(source.birthTime?.trim() || '')
      : source.birthTime?.trim() || '';
  const birthLocation = normalizeLocation(source);
  const relationshipDuration = source.relationshipDuration || '';

  return {
    ...source,
    birthDate: source.birthDate?.trim() || '',
    birthTime,
    isUnknownTime: precision === 'unknown',
    birthTimePrecision: precision,
    dayBoundaryPolicy: source.dayBoundaryPolicy === 'late-zi' ? 'late-zi' : 'midnight',
    birthLocation,
    location: source.location?.trim() || birthLocation?.label || '',
    timezone: birthLocation?.timezone,
    utcOffsetMinutes: birthLocation?.utcOffsetMinutes,
    latitude: birthLocation?.latitude,
    longitude: birthLocation?.longitude,
    applySolarTimeCorrection: birthLocation?.applySolarTimeCorrection,
    partner: normalizePartner(source.partner),
    relationshipDuration
  };
}

export function getIntakeFlowDiagnostics(source?: Partial<IntakeFormData> | null) {
  const normalized = normalizeIntakeFormData(source);

  return {
    hasBirthDate: Boolean(normalized.birthDate),
    birthTimePrecision: normalized.birthTimePrecision || 'unknown',
    hasBirthLocation: Boolean(normalized.birthLocation?.label),
    calendar: normalized.calendar || 'solar',
    hasQuestions: Boolean(normalized.q1?.trim() && normalized.q2?.trim())
  } as const;
}
