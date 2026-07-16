import type { FiveElement } from '../../constants';
import type { Bazi } from '../../types';
import type { RelationEvidence } from '../interactions';

export type RelationshipPurpose = 'dating' | 'marriage' | 'business' | 'family';
export type CompatibilityTendency = 'supportive' | 'conditional' | 'tension' | 'insufficient';
export type CompatibilityFactTendency = 'supportive' | 'mixed' | 'tension' | 'neutral';

export interface CompatibilityAnalysisInput {
  personA: Bazi;
  personB: Bazi;
  purpose: RelationshipPurpose;
}

export interface EvidenceConclusion {
  statement: string;
  evidenceIds: string[];
  confidence: number;
  uncertainty: string[];
}

export interface CompatibilityFact {
  id: string;
  category: 'day-master' | 'spouse-palace' | 'element-exchange' | 'relation-pattern';
  tendency: CompatibilityFactTendency;
  statement: string;
  confidence: number;
  uncertainty: string[];
  relationIds: string[];
}

export interface DayMasterDynamic {
  kind: 'same-element' | 'generation' | 'control';
  direction: 'mutual' | 'A-to-B' | 'B-to-A';
  personAElement: FiveElement;
  personBElement: FiveElement;
  conclusion: EvidenceConclusion;
}

export interface SpousePalaceDynamic {
  relationIds: string[];
  conclusion: EvidenceConclusion;
}

export interface ElementReceipt {
  recipient: 'personA' | 'personB';
  helpfulElements: FiveElement[];
  cautiousElements: FiveElement[];
  suppliedHelpfulElements: FiveElement[];
  suppliedCautiousElements: FiveElement[];
  missingHelpfulElements: FiveElement[];
  tendency: CompatibilityFactTendency;
  evidenceId: string;
}

export interface ElementExchange {
  personAReceives: ElementReceipt;
  personBReceives: ElementReceipt;
  mutuallyHelpfulElements: FiveElement[];
  mutuallyCautiousElements: FiveElement[];
  conclusion: EvidenceConclusion;
}

export interface CompatibilityDimension {
  id: string;
  label: string;
  tendency: CompatibilityTendency;
  statement: string;
  evidenceIds: string[];
  confidence: number;
  uncertainty: string[];
}

export interface CompatibilityOverview {
  tendency: CompatibilityTendency;
  statement: string;
  evidenceIds: string[];
  confidence: number;
  uncertainty: string[];
}

export interface CompatibilityAnalysisResult {
  engineVersion: '2.0.0';
  purpose: RelationshipPurpose;
  dayMaster: DayMasterDynamic;
  spousePalace: SpousePalaceDynamic;
  crossRelations: RelationEvidence[];
  elementExchange: ElementExchange;
  facts: CompatibilityFact[];
  dimensions: CompatibilityDimension[];
  overview: CompatibilityOverview;
  confidence: number;
  uncertainty: string[];
}
