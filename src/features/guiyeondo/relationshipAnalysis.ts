import type { IntakeFormData } from '../../api/mockData';
import {
  buildBirthCalculation,
  selectStableNatalBazi,
  type BirthContextOptions
} from '../../lib/saju/v2/calendar';
import {
  analyzeCompatibility,
  type CompatibilityDimension,
  type CompatibilityTendency,
  type RelationshipPurpose
} from '../../lib/saju/v2/compatibility';
import type {
  GuiyeondoBirthProfile,
  GuiyeondoRelationshipAnalysis,
  GuiyeondoRelationshipType,
  GuiyeondoVector,
  GuiyeondoVectorId
} from './types';

const PURPOSES: RelationshipPurpose[] = ['dating', 'marriage', 'business', 'family'];
type SupportedVectorId = Exclude<GuiyeondoVectorId, 'support' | 'growth'>;

const VECTOR_SOURCES: Record<SupportedVectorId, {
  label: string;
  purpose: RelationshipPurpose;
  dimensionId: string;
  invert?: boolean;
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

function toIntake(profile: GuiyeondoBirthProfile): Partial<IntakeFormData> {
  return { ...profile, relationshipStatus: '', relationshipDuration: '', q1: '', q2: '' };
}

function birthContextOptions(profile: GuiyeondoBirthProfile): BirthContextOptions {
  const location = profile.birthLocation;
  return {
    timezoneId: location.timezone,
    utcOffsetMinutes: location.utcOffsetMinutes,
    latitude: location.latitude,
    longitude: location.longitude,
    locationLabel: location.label || profile.location,
    applyTrueSolarTime: Boolean(location.applySolarTimeCorrection && location.longitude !== undefined),
    includeEquationOfTime: true,
    dayBoundaryPolicy: profile.dayBoundaryPolicy === 'late-zi'
      ? 'late-zi-next-day'
      : 'civil-midnight'
  };
}

/** Canonical Guiyeondo adapter: input identity and actual calendar context stay identical. */
export function buildGuiyeondoBirthCalculation(profile: GuiyeondoBirthProfile) {
  return buildBirthCalculation(toIntake(profile), birthContextOptions(profile));
}

/** Visual identity only: verified natal pillars, not names, drive the decorative sigil. */
export function assessGuiyeondoProfileStability(profile: GuiyeondoBirthProfile) {
  return selectStableNatalBazi(buildGuiyeondoBirthCalculation(profile));
}

export function guiyeondoSigilSeed(profile: GuiyeondoBirthProfile) {
  const natal = assessGuiyeondoProfileStability(profile).bazi;
  if (!natal) return 'natal-unresolved';
  return [natal.y_gz, natal.m_gz, natal.d_gz, natal.h_gz]
    .map((pillar) => pillar ? `${pillar.tg}:${pillar.dz}` : 'hour-unknown')
    .join('|');
}

function invertTendency(tendency: CompatibilityTendency): CompatibilityTendency {
  if (tendency === 'supportive') return 'tension';
  if (tendency === 'tension') return 'supportive';
  return tendency;
}

function toVector(
  id: SupportedVectorId,
  dimension: CompatibilityDimension,
  invert = false
): GuiyeondoVector {
  return {
    id,
    label: VECTOR_SOURCES[id].label,
    statement: dimension.statement,
    tendency: invert ? invertTendency(dimension.tendency) : dimension.tendency,
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

function calculationIdentity(profile: GuiyeondoBirthProfile) {
  return {
    gender: profile.gender,
    calendar: profile.calendar,
    isLeapMonth: profile.isLeapMonth,
    birthDate: profile.birthDate,
    birthTime: profile.birthTime,
    isUnknownTime: profile.isUnknownTime,
    birthTimePrecision: profile.birthTimePrecision,
    dayBoundaryPolicy: profile.dayBoundaryPolicy,
    birthLocation: {
      timezone: profile.birthLocation.timezone,
      utcOffsetMinutes: profile.birthLocation.utcOffsetMinutes,
      latitude: profile.birthLocation.latitude,
      longitude: profile.birthLocation.longitude,
      applySolarTimeCorrection: profile.birthLocation.applySolarTimeCorrection
    }
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

function classify(vectors: GuiyeondoVector[]): {
  type: GuiyeondoRelationshipType | null;
  evidenceIds: string[];
} {
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
  } else if (
    is('attraction', 'supportive') && is('romance', 'supportive') &&
    is('stability', 'supportive') && is('long-term', 'supportive')
  ) {
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

export function analyzeGuiyeondoRelationship(
  owner: GuiyeondoBirthProfile,
  guest: GuiyeondoBirthProfile
): GuiyeondoRelationshipAnalysis {
  const ownerCalculation = buildGuiyeondoBirthCalculation(owner);
  const guestCalculation = buildGuiyeondoBirthCalculation(guest);
  const ownerNatal = selectStableNatalBazi(ownerCalculation);
  const guestNatal = selectStableNatalBazi(guestCalculation);
  const ownerBazi = ownerNatal.bazi;
  const guestBazi = guestNatal.bazi;

  if (!ownerBazi || !guestBazi) {
    const reason = ownerNatal.status === 'blocked'
      ? ownerNatal.reason
      : guestNatal.status === 'blocked'
        ? guestNatal.reason
        : '두 사람의 공통 원국을 확정할 수 없습니다.';
    throw new Error(reason);
  }

  const purposes = Object.fromEntries(PURPOSES.map((purpose) => [
    purpose,
    analyzeCompatibility({ personA: ownerBazi, personB: guestBazi, purpose })
  ])) as GuiyeondoRelationshipAnalysis['purposes'];

  const supportedVectors = (Object.entries(VECTOR_SOURCES) as Array<[
    SupportedVectorId,
    (typeof VECTOR_SOURCES)[SupportedVectorId]
  ]>).map(([id, source]) => {
    const dimension = purposes[source.purpose].dimensions.find((item) => item.id === source.dimensionId);
    if (!dimension) throw new Error(`관계 분석 차원을 찾을 수 없습니다: ${source.dimensionId}`);
    return toVector(id, dimension, source.invert);
  });
  const vectors = [
    ...supportedVectors.slice(0, 3),
    unsupportedVector('support', '지원'),
    unsupportedVector('growth', '성장'),
    ...supportedVectors.slice(3)
  ];
  const provisional = classify(vectors);
  const status = ownerNatal.status === 'full' && guestNatal.status === 'full' ? 'full' : 'partial';
  const uncertainty = [...new Set([
    ...Object.values(purposes).flatMap((result) => result.uncertainty),
    ...(ownerNatal.status === 'partial' ? [ownerNatal.reason] : []),
    ...(guestNatal.status === 'partial' ? [guestNatal.reason] : []),
    '관계 카테고리는 검증된 명리 근거를 탐색하기 위한 운월당의 임시 UI 분류이며 미래나 관계 결과를 확정하지 않습니다.',
    '0~100 궁합 확률은 현재 검증 계약에 없으므로 표시하지 않습니다.'
  ])];
  const fingerprintSource = JSON.stringify({
    owner: calculationIdentity(owner),
    guest: calculationIdentity(guest),
    ownerVersion: ownerCalculation.version,
    guestVersion: guestCalculation.version,
    compatibility: purposes.dating.engineVersion,
    policy: 'guiyeondo-exploration-v0.1'
  });

  return {
    status,
    calendarVersions: { owner: ownerCalculation.version, guest: guestCalculation.version },
    compatibilityEngineVersion: purposes.dating.engineVersion,
    purposes,
    vectors,
    classification: {
      type: provisional.type,
      status: provisional.type ? 'provisional' : 'insufficient',
      policyVersion: provisional.type ? 'guiyeondo-exploration-v0.1' : null,
      evidenceIds: provisional.evidenceIds
    },
    calculationFingerprint: stableHash(fingerprintSource),
    uncertainty
  };
}
