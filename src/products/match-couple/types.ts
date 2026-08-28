import type { BirthLocationData, IntakeFormData, RelationshipStatus } from '../../api/mockData';
import type { FiveElement } from '../../lib/saju/constants';
import type { CompatibilityTendency } from '../../lib/saju/v2/compatibility';

export const MATCH_COUPLE_CONTEXT_VERSION = 'match-couple-v1' as const;

export type MatchCoupleRelationshipStatus = Exclude<RelationshipStatus, '' | 'single'>;
export type MatchCoupleRelationshipDuration =
  | 'under1'
  | 'under3'
  | 'under5'
  | 'under10'
  | 'over10';

export interface MatchCouplePersonInput {
  name: string;
  gender: 'male' | 'female';
  calendar: 'solar' | 'lunar';
  isLeapMonth: boolean;
  birthDate: string;
  birthTime: string;
  isUnknownTime: boolean;
  isUnknownLocation: boolean;
  birthLocation?: BirthLocationData;
}

export interface MatchCoupleContext {
  version: typeof MATCH_COUPLE_CONTEXT_VERSION;
  relationshipStatus: MatchCoupleRelationshipStatus | '';
  relationshipDuration: MatchCoupleRelationshipDuration | '';
  majorConflict: string;
  desiredInsight: string;
  questions: [string, string];
  selfLocationUnknown: boolean;
  partnerLocationUnknown: boolean;
  selfSolarTimeCorrectionRequested: boolean;
  partnerSolarTimeCorrectionRequested: boolean;
}

export interface MatchCoupleIntakeState {
  self: MatchCouplePersonInput;
  partner: MatchCouplePersonInput;
  context: MatchCoupleContext;
}

export type MatchCoupleStoredFormData = IntakeFormData & {
  matchCoupleContext: MatchCoupleContext;
};

export interface MatchCoupleInputValidation {
  valid: boolean;
  stepErrors: Record<1 | 2 | 3 | 4, string[]>;
}

export type MatchCoupleAvailability =
  | { status: 'available'; note?: string }
  | { status: 'limited'; note: string }
  | { status: 'unavailable'; note: string };

export interface MatchCouplePersonFacts {
  id: 'self' | 'partner';
  name: string;
  dayMaster: string;
  dayMasterElement: FiveElement;
  pillars: {
    year: string;
    month: string;
    day: string;
    hour: string | null;
  };
  fiveElements: Array<{ label: FiveElement; weight: number }>;
  tenGods: Array<{ label: string; weight: number }>;
  spousePalace: {
    branch: string;
    element: FiveElement;
    tenGod: string;
  };
  availability: MatchCoupleAvailability;
}

export type MatchCoupleRelationGroupId = 'combine' | 'clash' | 'punishment' | 'break' | 'harm';

export interface MatchCoupleRelationItem {
  id: string;
  name: string;
  subtype: string;
  description: string;
  evidenceIds: string[];
  uncertainty: string[];
}

export interface MatchCoupleRelationGroup {
  id: MatchCoupleRelationGroupId;
  label: '합' | '충' | '형' | '파' | '해';
  items: MatchCoupleRelationItem[];
}

export interface MatchCoupleDimension {
  id: string;
  label: string;
  tendency: CompatibilityTendency;
  statement: string;
  evidenceIds: string[];
  uncertainty: string[];
}

export interface MatchCoupleGuidanceItem extends MatchCoupleDimension {
  practicalRule: string;
}

export interface MatchCoupleThirtyDayExperiment {
  days: string;
  title: string;
  action: string;
  check: string;
}

export interface MatchCoupleReportModel {
  version: 'match-couple-report-v1';
  names: [string, string];
  relationshipSummary: string;
  context: MatchCoupleContext;
  people: [MatchCouplePersonFacts | null, MatchCouplePersonFacts | null];
  overview: MatchCoupleDimension | null;
  relations: MatchCoupleRelationGroup[];
  guidance: {
    attraction: MatchCoupleGuidanceItem;
    emotionalExpression: MatchCoupleGuidanceItem;
    communication: MatchCoupleGuidanceItem;
    conflictRecovery: MatchCoupleGuidanceItem;
    dailyLife: MatchCoupleGuidanceItem;
    money: MatchCoupleGuidanceItem;
    longTermRoles: MatchCoupleGuidanceItem;
  } | null;
  cautionWords: string[];
  cautionActions: string[];
  relationshipRules: string[];
  experiment: MatchCoupleThirtyDayExperiment[];
  questions: [string, string];
  limitations: string[];
  evidenceIds: string[];
  generatedFrom: {
    calendarEngine: string;
    compatibilityEngine: '2.0.0' | null;
  };
}
