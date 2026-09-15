import type { IntakeFormData } from '../../api/mockData';
import { validateBirthInput } from '../birthInputValidation';
import type { Bazi, GZ } from '../saju/types';
import {
  selectStableNatalBazi,
  type BirthCalculationResult
} from '../saju/v2/calendar';
import {
  analyzeCompatibility,
  type CompatibilityAnalysisResult,
  type CompatibilityDimension,
  type CompatibilityTendency,
  type RelationshipPurpose
} from '../saju/v2/compatibility';

const PURPOSES: RelationshipPurpose[] = ['dating', 'marriage', 'business', 'family'];
const PROFILE_NAME_MAX_LENGTH = 20;
const LABEL_MAX_LENGTH = 80;
const TIMEZONE_MAX_LENGTH = 64;

export type GuiyeondoRelationshipType =
  | 'soulmate'
  | 'destined-love'
  | 'life-benefactor'
  | 'wealth-benefactor'
  | 'success-benefactor'
  | 'growth-relation'
  | 'passion-relation'
  | 'caution-relation';

export type GuiyeondoVectorId =
  | 'romance'
  | 'attraction'
  | 'comfort'
  | 'support'
  | 'growth'
  | 'wealth-synergy'
  | 'career-synergy'
  | 'stability'
  | 'challenge'
  | 'long-term';

export interface GuiyeondoBirthProfileInput {
  name: string;
  gender: 'male' | 'female';
  calendar: 'solar' | 'lunar';
  isLeapMonth: boolean;
  birthDate: string;
  birthTime: string;
  isUnknownTime: boolean;
  birthTimePrecision: 'exact' | 'unknown';
  dayBoundaryPolicy: 'midnight' | 'late-zi';
  location: string;
  birthLocation: NonNullable<IntakeFormData['birthLocation']>;
}

export interface GuiyeondoNatalSnapshot {
  yGz: GZ;
  mGz: GZ;
  dGz: GZ;
  hGz: GZ | null;
  status: 'full' | 'partial';
  calendarVersion: string;
}

export interface GuiyeondoVector {
  id: GuiyeondoVectorId;
  label: string;
  statement: string;
  tendency: CompatibilityTendency;
  confidence: number;
  evidenceIds: string[];
  uncertainty: string[];
  supported: boolean;
}

export interface GuiyeondoServerAnalysis {
  status: 'full' | 'partial';
  calendarVersions: { owner: string; guest: string };
  compatibilityEngineVersion: '2.0.0';
  purposes: Record<RelationshipPurpose, CompatibilityAnalysisResult>;
  vectors: GuiyeondoVector[];
  classification: {
    type: GuiyeondoRelationshipType | null;
    status: 'provisional' | 'insufficient';
    policyVersion: 'guiyeondo-exploration-v0.1' | null;
    evidenceIds: string[];
  };
  calculationFingerprint: string;
  uncertainty: string[];
}

export class GuiyeondoProfileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GuiyeondoProfileValidationError';
  }
}

type SupportedVectorId = Exclude<GuiyeondoVectorId, 'support' | 'growth'>;

const VECTOR_SOURCES: Record<SupportedVectorId, {
  label: string;
  purpose: RelationshipPurpose;
  dimensionId: string;
}> = {
  romance: { label: '감정 교류', purpose: 'dating', dimensionId: 'dating-emotional-flow' },
  attraction: { label: '끌림', purpose: 'dating', dimensionId: 'dating-attraction' },
  comfort: { label: '편안함', purpose: 'family', dimensionId: 'family-emotional-safety' },
  'wealth-synergy': { label: '현실 시너지', purpose: 'business', dimensionId: 'business-resource-flow' },
  'career-synergy': { label: '일의 시너지', purpose: 'business', dimensionId: 'business-execution' },
  stability: { label: '생활 안정', purpose: 'marriage', dimensionId: 'marriage-spouse-palace' },
  challenge: { label: '조정 압력', purpose: 'marriage', dimensionId: 'marriage-conflict-repair' },
  'long-term': { label: '장기 조율', purpose: 'marriage', dimensionId: 'marriage-long-term-coordination' }
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function requiredString(source: Record<string, unknown>, key: string, maxLength: number) {
  const value = source[key];
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new GuiyeondoProfileValidationError('출생정보 입력값이 올바르지 않습니다.');
  }
  return value.trim();
}

function requiredBoolean(source: Record<string, unknown>, key: string) {
  const value = source[key];
  if (typeof value !== 'boolean') {
    throw new GuiyeondoProfileValidationError('출생정보 입력값이 올바르지 않습니다.');
  }
  return value;
}

/** Strictly parses untrusted API input and runs the production calendar preflight. */
export function parseGuiyeondoBirthProfile(value: unknown): {
  profile: GuiyeondoBirthProfileInput;
  calculation: BirthCalculationResult;
} {
  const source = record(value);
  const locationSource = source ? record(source.birthLocation) : null;
  if (!source || !locationSource) {
    throw new GuiyeondoProfileValidationError('출생정보 입력값이 올바르지 않습니다.');
  }

  const gender = source.gender;
  const calendar = source.calendar;
  const birthTimePrecision = source.birthTimePrecision;
  const dayBoundaryPolicy = source.dayBoundaryPolicy;
  if (
    (gender !== 'male' && gender !== 'female') ||
    (calendar !== 'solar' && calendar !== 'lunar') ||
    (birthTimePrecision !== 'exact' && birthTimePrecision !== 'unknown') ||
    (dayBoundaryPolicy !== 'midnight' && dayBoundaryPolicy !== 'late-zi')
  ) {
    throw new GuiyeondoProfileValidationError('출생정보 입력값이 올바르지 않습니다.');
  }

  const timezone = requiredString(locationSource, 'timezone', TIMEZONE_MAX_LENGTH);
  const label = requiredString(locationSource, 'label', LABEL_MAX_LENGTH);
  const utcOffsetMinutes = locationSource.utcOffsetMinutes;
  const latitude = locationSource.latitude;
  const longitude = locationSource.longitude;
  const applySolarTimeCorrection = locationSource.applySolarTimeCorrection;
  if (
    (utcOffsetMinutes !== undefined && (!Number.isInteger(utcOffsetMinutes) || Number(utcOffsetMinutes) < -840 || Number(utcOffsetMinutes) > 840)) ||
    (latitude !== undefined && (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
    (longitude !== undefined && (typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180)) ||
    (applySolarTimeCorrection !== undefined && typeof applySolarTimeCorrection !== 'boolean')
  ) {
    throw new GuiyeondoProfileValidationError('출생지 입력값이 올바르지 않습니다.');
  }

  const profile: GuiyeondoBirthProfileInput = {
    name: requiredString(source, 'name', PROFILE_NAME_MAX_LENGTH),
    gender,
    calendar,
    isLeapMonth: requiredBoolean(source, 'isLeapMonth'),
    birthDate: requiredString(source, 'birthDate', 10),
    birthTime: typeof source.birthTime === 'string' ? source.birthTime.trim() : '',
    isUnknownTime: requiredBoolean(source, 'isUnknownTime'),
    birthTimePrecision,
    dayBoundaryPolicy,
    location: requiredString(source, 'location', LABEL_MAX_LENGTH),
    birthLocation: {
      label,
      timezone,
      ...(utcOffsetMinutes === undefined ? {} : { utcOffsetMinutes: Number(utcOffsetMinutes) }),
      ...(latitude === undefined ? {} : { latitude: Number(latitude) }),
      ...(longitude === undefined ? {} : { longitude: Number(longitude) }),
      ...(applySolarTimeCorrection === undefined ? {} : { applySolarTimeCorrection: Boolean(applySolarTimeCorrection) })
    }
  };
  const validation = validateBirthInput(profile, { subjectLabel: profile.name });
  if (!validation.valid || !validation.calculation) {
    throw new GuiyeondoProfileValidationError(
      validation.errors[0]?.message || '출생정보를 계산할 수 없습니다.'
    );
  }
  return { profile, calculation: validation.calculation };
}

export function createGuiyeondoNatalSnapshot(
  calculation: BirthCalculationResult
): GuiyeondoNatalSnapshot {
  const natal = selectStableNatalBazi(calculation);
  if (natal.status === 'blocked') {
    throw new GuiyeondoProfileValidationError(natal.reason);
  }
  return {
    yGz: { ...natal.bazi.y_gz },
    mGz: { ...natal.bazi.m_gz },
    dGz: { ...natal.bazi.d_gz },
    hGz: natal.bazi.h_gz ? { ...natal.bazi.h_gz } : null,
    status: natal.status,
    calendarVersion: calculation.version
  };
}

function snapshotBazi(snapshot: GuiyeondoNatalSnapshot): Bazi {
  return {
    y_gz: snapshot.yGz,
    m_gz: snapshot.mGz,
    d_gz: snapshot.dGz,
    h_gz: snapshot.hGz,
    solar: [0, 0, 0],
    lunar_in: null,
    start_age: 0,
    forward: false,
    calculationBasis: { ipchun: '', isAfterIpchun: false }
  };
}

function toVector(id: SupportedVectorId, dimension: CompatibilityDimension): GuiyeondoVector {
  return {
    id,
    label: VECTOR_SOURCES[id].label,
    statement: dimension.statement,
    tendency: dimension.tendency,
    confidence: dimension.confidence,
    evidenceIds: dimension.evidenceIds,
    uncertainty: dimension.uncertainty,
    supported: true
  };
}

function unsupportedVector(id: 'support' | 'growth', label: string): GuiyeondoVector {
  return {
    id,
    label,
    statement: '현재 검증된 관계 계산 기준에서 독립 근거를 확정하지 못한 항목입니다.',
    tendency: 'insufficient',
    confidence: 0,
    evidenceIds: [],
    uncertainty: ['현재 검증된 궁합 엔진에 이 벡터의 독립 계산 기준이 없어 임의 점수를 만들지 않았습니다.'],
    supported: false
  };
}

function classify(vectors: GuiyeondoVector[]) {
  const vectorMap = new Map(vectors.map((vector) => [vector.id, vector]));
  const is = (id: GuiyeondoVectorId, tendency: CompatibilityTendency) =>
    vectorMap.get(id)?.tendency === tendency;
  let type: GuiyeondoRelationshipType | null = null;
  let triggerVectorIds: GuiyeondoVectorId[] = [];

  if (is('challenge', 'tension') && (is('stability', 'tension') || is('comfort', 'tension'))) {
    type = 'caution-relation';
    triggerVectorIds = ['challenge', is('stability', 'tension') ? 'stability' : 'comfort'];
  } else if (is('attraction', 'supportive') && is('stability', 'tension')) {
    type = 'passion-relation';
    triggerVectorIds = ['attraction', 'stability'];
  } else if (is('attraction', 'supportive') && is('romance', 'supportive') && is('stability', 'supportive') && is('long-term', 'supportive')) {
    type = 'soulmate';
    triggerVectorIds = ['attraction', 'romance', 'stability', 'long-term'];
  } else if (is('attraction', 'supportive') && is('romance', 'supportive')) {
    type = 'destined-love';
    triggerVectorIds = ['attraction', 'romance'];
  } else if (is('wealth-synergy', 'supportive')) {
    type = 'wealth-benefactor';
    triggerVectorIds = ['wealth-synergy'];
  } else if (is('career-synergy', 'supportive')) {
    type = 'success-benefactor';
    triggerVectorIds = ['career-synergy'];
  } else if (is('comfort', 'supportive')) {
    type = 'life-benefactor';
    triggerVectorIds = ['comfort'];
  }

  return {
    type,
    evidenceIds: type
      ? [...new Set(triggerVectorIds.flatMap((id) => vectorMap.get(id)?.evidenceIds || []))]
      : []
  };
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `gy-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function createGuiyeondoSigilSeed(snapshot: GuiyeondoNatalSnapshot) {
  return stableHash(JSON.stringify({
    y: snapshot.yGz,
    m: snapshot.mGz,
    d: snapshot.dGz,
    h: snapshot.hGz,
    version: snapshot.calendarVersion
  }));
}

export function analyzeGuiyeondoSnapshots(
  owner: GuiyeondoNatalSnapshot,
  guest: GuiyeondoNatalSnapshot
): GuiyeondoServerAnalysis {
  const ownerBazi = snapshotBazi(owner);
  const guestBazi = snapshotBazi(guest);
  const purposes = Object.fromEntries(PURPOSES.map((purpose) => [
    purpose,
    analyzeCompatibility({ personA: ownerBazi, personB: guestBazi, purpose })
  ])) as Record<RelationshipPurpose, CompatibilityAnalysisResult>;
  const supportedVectors = (Object.entries(VECTOR_SOURCES) as Array<[
    SupportedVectorId,
    (typeof VECTOR_SOURCES)[SupportedVectorId]
  ]>).map(([id, source]) => {
    const dimension = purposes[source.purpose].dimensions.find((item) => item.id === source.dimensionId);
    if (!dimension) throw new Error('관계 분석 차원을 찾을 수 없습니다.');
    return toVector(id, dimension);
  });
  const vectors: GuiyeondoVector[] = [
    ...supportedVectors.slice(0, 3),
    unsupportedVector('support', '지원'),
    unsupportedVector('growth', '성장'),
    ...supportedVectors.slice(3)
  ];
  const classification = classify(vectors);
  const uncertainty = [...new Set([
    ...Object.values(purposes).flatMap((result) => result.uncertainty),
    ...(owner.status === 'partial' ? ['초대자의 출생시간이 미상이므로 시주 관계를 제외했습니다.'] : []),
    ...(guest.status === 'partial' ? ['응답자의 출생시간이 미상이므로 시주 관계를 제외했습니다.'] : []),
    '관계 카테고리는 검증된 명리 근거를 탐색하기 위한 운월당의 임시 UI 분류이며 미래나 관계 결과를 확정하지 않습니다.',
    '0~100 궁합 확률은 현재 검증 계약에 없으므로 표시하지 않습니다.'
  ])];

  return {
    status: owner.status === 'full' && guest.status === 'full' ? 'full' : 'partial',
    calendarVersions: { owner: owner.calendarVersion, guest: guest.calendarVersion },
    compatibilityEngineVersion: purposes.dating.engineVersion,
    purposes,
    vectors,
    classification: {
      type: classification.type,
      status: classification.type ? 'provisional' : 'insufficient',
      policyVersion: classification.type ? 'guiyeondo-exploration-v0.1' : null,
      evidenceIds: classification.evidenceIds
    },
    calculationFingerprint: stableHash(JSON.stringify({
      owner,
      guest,
      compatibility: purposes.dating.engineVersion,
      policy: 'guiyeondo-exploration-v0.1'
    })),
    uncertainty
  };
}
