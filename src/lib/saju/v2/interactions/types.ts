import type { EarthlyBranch, FiveElement, HeavenlyStem, TenGodLabel } from '../../constants';
import type { Bazi, GZ } from '../../types';

export type RelationLayer =
  | 'natal'
  | 'dayun'
  | 'seun'
  | 'wolyun'
  | 'personA'
  | 'personB';

export type PillarPosition = 'year' | 'month' | 'day' | 'hour' | 'luck';
export type RelationComponent = 'stem' | 'branch';

export type RelationKind =
  | 'stem-combination'
  | 'stem-clash'
  | 'six-combination'
  | 'clash'
  | 'punishment'
  | 'break'
  | 'harm'
  | 'resentment'
  | 'three-harmony'
  | 'seasonal-harmony';

export type RelationPolarity = 'integrative' | 'transformative' | 'friction' | 'latent-friction' | 'mixed';

export interface RelationParticipant {
  id: string;
  layer: RelationLayer;
  position: PillarPosition;
  component: RelationComponent;
  index: number;
  label: HeavenlyStem | EarthlyBranch;
  element: FiveElement;
}

export interface RelationEvidence {
  id: string;
  relation: RelationKind;
  name: string;
  subtype?: string;
  polarity: RelationPolarity;
  participants: RelationParticipant[];
  transformedElement?: FiveElement;
  description: string;
  confidence: number;
  uncertainty: string[];
}

export type RelationDetectionScope = 'all' | 'cross-layer-only' | 'within-layer-only';

export interface RelationDetectionOptions {
  scope?: RelationDetectionScope;
}

export interface TemporalPillarInput {
  gz: GZ;
  label?: string;
  referenceYear?: number;
}

export interface TemporalAnalysisInput {
  natal: Bazi;
  dayun?: TemporalPillarInput;
  seun?: TemporalPillarInput;
  wolyun?: TemporalPillarInput;
}

export interface TenGodActivation {
  id: string;
  layer: Exclude<RelationLayer, 'natal' | 'personA' | 'personB'>;
  source: 'stem' | 'branch' | 'hidden-stem';
  sourceLabel: HeavenlyStem | EarthlyBranch;
  tenGod: TenGodLabel;
  themes: string[];
  salience: 'primary' | 'supporting';
  confidence: number;
  evidenceIds: string[];
  uncertainty: string[];
}

export interface TemporalLayerSnapshot {
  layer: 'natal' | 'dayun' | 'seun' | 'wolyun';
  label: string;
  gz?: GZ;
  referenceYear?: number;
}

export interface TemporalFinding {
  id: string;
  topic: string;
  tendency: 'integration' | 'activation' | 'tension' | 'latent-tension' | 'conditional';
  statement: string;
  evidenceIds: string[];
  confidence: number;
  uncertainty: string[];
}

export interface TemporalAnalysisResult {
  engineVersion: '2.0.0';
  layers: TemporalLayerSnapshot[];
  relations: RelationEvidence[];
  tenGodActivations: TenGodActivation[];
  findings: TemporalFinding[];
  confidence: number;
  uncertainty: string[];
}
