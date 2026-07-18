import type { EarthlyBranch, FiveElement, HeavenlyStem } from '../../constants';

export const INTERPRETATION_ENGINE_VERSION = '2.0.0-alpha.1';

export type PillarPosition = 'year' | 'month' | 'day' | 'hour';
export type RuleStatus = 'supported' | 'conditional' | 'insufficient';
export type ConfidenceLevel = 'low' | 'medium' | 'high';
export type EvidenceKind = 'support' | 'opposition' | 'context' | 'limitation';

export interface RuleMetadata {
  ruleId: string;
  sourceNote: string;
  version: string;
}

export interface Confidence {
  score: number;
  level: ConfidenceLevel;
  reasons: string[];
  limitations: string[];
}

export interface Evidence extends RuleMetadata {
  id: string;
  kind: EvidenceKind;
  statement: string;
  weight: number;
  paths: string[];
}

export interface RuleResult<T> extends RuleMetadata {
  status: RuleStatus;
  value: T;
  confidence: Confidence;
  evidence: Evidence[];
  caveats: string[];
}

export type SeasonName = 'spring' | 'summer' | 'autumn' | 'winter' | 'transition';

export interface MonthCommandProfile {
  monthBranch: EarthlyBranch;
  season: SeasonName;
  commandingElement: FiveElement;
  dayMaster: HeavenlyStem;
  dayMasterElement: FiveElement;
  obtainsCommand: boolean;
  receivesSeasonalSupport: boolean;
  relation: 'same' | 'produced-by-season' | 'produces-season' | 'controlled-by-season' | 'controls-season';
}

export type HiddenQiRole = 'residual' | 'middle' | 'main';

export interface RootSource {
  branchPosition: PillarPosition;
  branch: EarthlyBranch;
  hiddenStem: HeavenlyStem;
  hiddenRole: HiddenQiRole;
  kind: 'same-stem' | 'same-element';
  score: number;
}

export interface StemRootProfile {
  pillar: PillarPosition;
  stem: HeavenlyStem;
  element: FiveElement;
  rooted: boolean;
  level: 'none' | 'weak' | 'moderate' | 'strong';
  score: number;
  sources: RootSource[];
}

export interface StemExposureProfile {
  pillar: PillarPosition;
  stem: HeavenlyStem;
  exposedFromHidden: boolean;
  sources: Array<{
    branchPosition: PillarPosition;
    branch: EarthlyBranch;
    hiddenRole: HiddenQiRole;
  }>;
}

export interface HiddenStemExposure {
  branchPosition: PillarPosition;
  branch: EarthlyBranch;
  hiddenStem: HeavenlyStem;
  hiddenRole: HiddenQiRole;
  exposedBy: PillarPosition[];
}

export interface ExposureAnalysis {
  visibleStems: StemExposureProfile[];
  hiddenStems: HiddenStemExposure[];
}

export interface HiddenStemContribution {
  branchPosition: PillarPosition;
  branch: EarthlyBranch;
  stem: HeavenlyStem;
  element: FiveElement;
  role: HiddenQiRole;
  intrinsicWeight: number;
  positionWeight: number;
  seasonalAffinity: number;
  rawContribution: number;
  relativeShare: number;
}

export interface HiddenStemSeasonality {
  monthElement: FiveElement;
  contributions: HiddenStemContribution[];
  elementShares: Record<FiveElement, number>;
}

export interface ElementPowerProfile {
  raw: Record<FiveElement, number>;
  shares: Record<FiveElement, number>;
  dominant: FiveElement[];
  scarce: FiveElement[];
}

export interface ClimateNeed {
  element: FiveElement;
  score: number;
  axis: 'temperature' | 'moisture';
  rationale: string;
}

export interface ClimateProfile {
  heatScore: number;
  moistureScore: number;
  temperature: 'cold' | 'balanced' | 'hot';
  moisture: 'dry' | 'balanced' | 'wet';
  needs: ClimateNeed[];
}

export interface InterpretationFoundations {
  monthCommand: RuleResult<MonthCommandProfile>;
  roots: RuleResult<StemRootProfile[]>;
  exposures: RuleResult<ExposureAnalysis>;
  hiddenSeasonality: RuleResult<HiddenStemSeasonality>;
  elementPower: RuleResult<ElementPowerProfile>;
  climate: RuleResult<ClimateProfile>;
}

export type YongsinMethod = 'eokbu' | 'johu' | 'tonggwan' | 'byeongyak' | 'special';

export interface ElementRecommendation {
  element: FiveElement;
  score: number;
  rationale: string;
  supportingEvidence: Evidence[];
  opposingEvidence: Evidence[];
  conditions: string[];
}

export interface YongsinAssessment {
  summary: string;
  candidates: ElementRecommendation[];
  cautions: ElementRecommendation[];
}

export type YongsinOpinion = RuleResult<YongsinAssessment> & {
  method: YongsinMethod;
};

export interface ConsensusContribution {
  method: YongsinMethod;
  score: number;
  confidence: number;
  evidence: Evidence[];
}

export interface ConsensusElement {
  element: FiveElement;
  netScore: number;
  supporting: ConsensusContribution[];
  opposing: ConsensusContribution[];
  agreementCount: number;
  hasConflict: boolean;
}

export interface ConsensusConflict {
  type: 'direct-opposition' | 'priority-divergence';
  element: FiveElement | null;
  methods: YongsinMethod[];
  description: string;
  evidence: Evidence[];
}

export interface ConsensusAssessment {
  summary: string;
  ranking: ConsensusElement[];
  primaryCandidates: FiveElement[];
  conflicts: ConsensusConflict[];
  unresolved: boolean;
}

export interface ExpertInterpretation {
  foundations: InterpretationFoundations;
  yongsinOpinions: YongsinOpinion[];
  consensus: RuleResult<ConsensusAssessment>;
}
