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
  /** Required for invite answers so local copies expire with the server invite. */
  expiresAt?: string;
  /** Transient result/handoff data; all participant birth profiles are stripped before map persistence. */
  privateBirthProfile?: GuiyeondoBirthProfile;
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
  /** Local owner capability only. Never put this value in a URL or public response. */
  ownerKey: string;
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
