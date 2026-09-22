import type { IntakeFormData } from '../../api/mockData';
import type {
  CompatibilityAnalysisResult,
  CompatibilityTendency,
  RelationshipPurpose
} from '../../lib/saju/v2/compatibility';

export const GUIYEONDO_RELATIONSHIP_TYPES = [
  'soulmate',
  'destined-love',
  'life-benefactor',
  'wealth-benefactor',
  'success-benefactor',
  'growth-relation',
  'passion-relation',
  'caution-relation'
] as const;

export type GuiyeondoRelationshipType = (typeof GUIYEONDO_RELATIONSHIP_TYPES)[number];
export type GuiyeondoAnalysisStatus = 'full' | 'partial' | 'blocked';
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

export interface GuiyeondoBirthProfile {
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

export interface GuiyeondoRelationshipAnalysis {
  status: GuiyeondoAnalysisStatus;
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

export interface GuiyeondoPerson {
  id: string;
  name: string;
  source: 'direct' | 'invite';
  createdAt: string;
  /**
   * 계정에 남은 인연 문서의 식별자.
   *
   * 이 값이 있으면 이 사람은 서버에도 있다 — 기기를 바꿔도 돌아오고, 다른 기기에서
   * 지우면 여기서도 없어진다. 아직 못 올린 사람은 비어 있고, 동기화가 건드리지 않는다.
   */
  connectionId?: string;
  /**
   * 이 계산에서 내가 `personB` 였는지.
   *
   * 남의 초대에 응답해서 가져온 인연은 **초대한 쪽을 `personA`** 로 놓고 계산됐다.
   * 그 문장을 내 지도에서 그대로 풀면 "personA" 자리에 내 이름이 들어가 두 사람이
   * 뒤바뀐다. 그래서 방향을 들고 다닌다. 내가 만든 인연에는 없다(= 기본값 앞자리).
   */
  reversed?: boolean;
  /**
   * 예전 동의(`guiyeondo-share-v1`)로 들어온 초대 응답만 이 값을 가진다. 그 동의는
   * "초대 만료일까지 보관" 이었으므로 그대로 만료시킨다. 새로 맺어지는 인연에는 없다.
   */
  expiresAt?: string;
  /** Transient result/handoff data; all participant birth profiles are stripped before map persistence. */
  privateBirthProfile?: GuiyeondoBirthProfile;
  analysis: GuiyeondoRelationshipAnalysis;
}

/**
 * 계정에 남은 인연 한 건.
 *
 * `GuiyeondoPerson` 과 달리 `expiresAt` 이 없다. 초대 링크는 14일에 닫히지만 이미 맺어진
 * 인연은 두 사람 중 누군가 지울 때까지 남기 때문이다. 서버가 보는 사람 기준으로 접어서
 * 주므로 `name` 은 항상 **상대의 이름**이다.
 */
export interface GuiyeondoConnection {
  connectionId: string;
  personId: string;
  kind: 'invite' | 'direct';
  name: string;
  /** `host` 는 내가 링크를 만든 쪽, `guest` 는 내가 응답한 쪽. */
  role: 'host' | 'guest';
  createdAt: string;
  analysis: GuiyeondoRelationshipAnalysis;
}

export interface GuiyeondoInvite {
  publicId: string;
  hostName: string;
  createdAt: string;
  expiresAt: string;
  /** Opaque decorative seed. It does not contain birth data or natal pillars. */
  sigilSeed: string;
}

export interface GuiyeondoOwnedInvite extends GuiyeondoInvite {
  /** Legacy local capability, ignored by the account-bound server API. */
  ownerKey?: string;
}

export interface GuiyeondoMapState {
  version: 1;
  owner: GuiyeondoBirthProfile;
  people: GuiyeondoPerson[];
  /** Local opt-out: removed remote answers do not reappear after owner sync. */
  hiddenInvitePersonIds?: string[];
  invites: GuiyeondoOwnedInvite[];
  createdAt: string;
  updatedAt: string;
}
