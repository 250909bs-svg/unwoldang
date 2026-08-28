import type { IntakeFormData, LoveFocus } from '../../api/mockData';
import type { SajuReportData } from '../saju/report';

export const RELATIONSHIP_STATUSES = [
  'single', 'meeting', 'situationship', 'dating', 'ambiguous', 'breakup-reunion', 'long-term',
] as const;
export type RelationshipStatus = (typeof RELATIONSHIP_STATUSES)[number];

export const MZ_LOVE_CHAPTER_IDS = [
  'love-self', 'repeated-attraction', 'attracted-partner', 'lasting-partner',
  'attraction-comparison', 'next-partner', 'meeting-scenes', 'twelve-month-timing',
  'communication-pattern', 'relationship-status', 'relationship-flags', 'action-plan', 'final-fact',
] as const;
export type MzLoveChapterId = (typeof MZ_LOVE_CHAPTER_IDS)[number];

export const MZ_LOVE_SCENE_KEYS = [
  'hero-fan-closed', 'whisper-fact', 'love-self-mirror', 'attraction-danger',
  'stable-partner-signal', 'final-fact-bomb', 'attraction-vs-longevity',
  'future-partner-fan', 'first-meeting-scene', 'waiting-for-message',
  'room-corridor', 'room-consultation', 'red-thread-knot',
  'green-flag-lantern', 'red-flag-warning', 'timing-rising-moon',
  'timing-pause-moon', 'closure-thread-cut', 'boundary-circle',
  'action-plan-calendar', 'message-do-dont', 'attraction-spark',
  'longevity-lantern', 'self-worth-crown', 'friend-introduction-door',
  'work-connection-table', 'hobby-meeting-studio', 'moonlit-date',
  'reunion-shadow', 'report-seal-final',
] as const;
export type MzLoveSceneKey = (typeof MZ_LOVE_SCENE_KEYS)[number];

export interface MzLoveInput {
  displayName: string;
  relationshipStatus: RelationshipStatus;
  relationshipDuration?: IntakeFormData['relationshipDuration'];
  interestedIn?: 'men' | 'women' | 'any' | 'prefer-not-to-say';
  birthTimeKnown: boolean;
  primaryQuestion?: string;
  microChoice?: 'A' | 'B' | 'C' | 'D';
  loveFocus?: LoveFocus;
}

export type EvidenceSource = 'natal-chart' | 'ten-god' | 'relationship' | 'timing' | 'engine-meta';

/** Immutable evidence copied from the deterministic saju engine. */
export interface EvidenceTag {
  id: string;
  label: string;
  value: string;
  description: string;
  source: EvidenceSource;
  sourcePath: string;
  immutable: true;
  confidence?: number;
  uncertainty?: string;
}

/**
 * Inputs considered while selecting personalised copy. Unlike EvidenceTag,
 * this never claims that a displayed interpretation was copied verbatim from
 * a deterministic engine field.
 */
export interface CalculationBasisTag {
  id: string;
  label: string;
  value: string;
  description: string;
  sourcePath: string;
  kind: 'chart' | 'timing' | 'intake';
}

export interface SajuChartSummary {
  sourceReportSerial: string;
  dayMaster: string;
  dayMasterElement: SajuReportData['dayMasterElement'];
  strengthLabel: string;
  pillars: SajuReportData['pillars'];
  helpfulElements: readonly SajuReportData['dayMasterElement'][];
  cautiousElements: readonly SajuReportData['dayMasterElement'][];
  dominantTenGods: ReadonlyArray<{ label: string; value: number }>;
  birthTimeKnown: boolean;
  calculationPrecision: 'exact-minute' | 'legacy-range' | 'unknown';
  evidence: readonly EvidenceTag[];
  uncertainty: readonly string[];
}

export interface DerivedRelationshipFact {
  id: string;
  kind: 'love-self' | 'attraction' | 'stability' | 'communication' | 'timing' | 'boundary';
  statement: string;
  evidence: readonly EvidenceTag[];
  confidence: number;
  uncertainty?: string;
}

export interface CharacterLine {
  speaker: 'mz-shaman';
  text: string;
  tone: 'warm' | 'direct' | 'warning' | 'encouraging';
}

export interface FactBombResult {
  id: string;
  factBomb: string;
  interpretation: string;
  evidence: readonly EvidenceTag[];
  realLifeScene: string;
  counterpoint: string;
  checkSignal: string;
  action: string;
  characterLine: CharacterLine;
}

export interface LovePartnerTendency {
  headline: string;
  traits: readonly string[];
  earlySignals: readonly string[];
  cautionSignals: readonly string[];
  evidence: readonly EvidenceTag[];
}

export interface AttractionComparison {
  attracted: LovePartnerTendency;
  lasting: LovePartnerTendency;
  decisiveCheck: string;
}

export interface LoveTimingPeriod {
  id: string;
  periodLabel: string;
  temperature: number;
  flow: string;
  caution: string;
  action: string;
  evidence: readonly EvidenceTag[];
  conditional: true;
}

export interface SceneFocalPoint { x: number; y: number }
export interface SceneArtwork {
  key: MzLoveSceneKey;
  src: string;
  alt: string;
  width: number;
  height: number;
  focalPoint: SceneFocalPoint;
  kind: 'character' | 'space' | 'symbolic';
}

export type ChapterLayout = 'cinematic' | 'mirror' | 'comparison' | 'timeline' | 'conversation' | 'flags' | 'checklist';
export interface LoveReportChapter {
  id: MzLoveChapterId;
  order: number;
  title: string;
  subtitle?: string;
  result: FactBombResult;
  derivedFacts: readonly DerivedRelationshipFact[];
  sceneKey: MzLoveSceneKey | null;
  layout: ChapterLayout;
  locked: boolean;
}

export interface MzLoveActionPlan {
  stop: readonly string[];
  start: readonly string[];
  check: readonly string[];
  thirtyDays: ReadonlyArray<{ week: 1 | 2 | 3 | 4; title: string; task: string }>;
}

export interface MzLovePreview {
  reportId: string;
  displayName: string;
  openingFact: FactBombResult;
  attractedPartner: LovePartnerTendency;
  currentTemperature: number;
  lockedChapterIds: readonly MzLoveChapterId[];
}

export interface MzLoveReport {
  meta: { id: string; version: 'mz-love-fact-v1'; createdAt: string; sourceReportSerial: string };
  user: MzLoveInput;
  sajuSummary: SajuChartSummary;
  openingFact: FactBombResult;
  loveSelf: FactBombResult;
  repeatedPattern: FactBombResult;
  attractedPartner: LovePartnerTendency;
  lastingPartner: LovePartnerTendency;
  attractionComparison: AttractionComparison;
  nextPartner: LovePartnerTendency;
  meetingScenes: readonly string[];
  twelveMonthTiming: readonly LoveTimingPeriod[];
  communicationPattern: FactBombResult;
  relationshipStatusBranch: FactBombResult;
  redFlags: readonly string[];
  greenFlags: readonly string[];
  actionPlan: MzLoveActionPlan;
  finalFact: FactBombResult;
  chapters: readonly LoveReportChapter[];
  calculationBasisByChapter?: Readonly<
    Partial<Record<MzLoveChapterId, readonly CalculationBasisTag[]>>
  >;
  shareCards: readonly string[];
  recommendations: readonly string[];
  disclaimers: readonly string[];
}

export type ReportGenerationStatus = 'queued' | 'calculating_chart' | 'deriving_relationship_facts' | 'generating_content' | 'validating_content' | 'selecting_artwork' | 'rendering_report' | 'completed' | 'failed';
export type MzLoveExperienceState = 'TEASER_ENTRY' | 'ROOM_ENTER' | 'CHARACTER_REVEAL' | 'MICRO_CHOICE' | 'BIRTH_INPUT' | 'SAJU_CALCULATION' | 'FREE_FACT_REVEAL' | 'LOCKED_CHAPTERS' | 'CHECKOUT' | 'FULL_GENERATION' | 'REPORT_OPENING' | 'REPORT_CHAPTERS' | 'ACTION_PLAN' | 'SHARE_AND_RECOMMEND';

export interface MzLoveStateSnapshot {
  version: 1;
  state: MzLoveExperienceState;
  updatedAt: string;
  previewId?: string;
  reportId?: string;
  microChoice?: MzLoveInput['microChoice'];
  paymentStatus: 'not-started' | 'pending' | 'confirmed';
  generationStatus?: ReportGenerationStatus;
  completedChapterIds: readonly MzLoveChapterId[];
  errorCode?: string;
}

export interface MzLoveChapterViewModel {
  id: MzLoveChapterId;
  order: number;
  eyebrow: string;
  title: string;
  subtitle?: string;
  factBomb: string;
  interpretation: string;
  evidence: readonly EvidenceTag[];
  calculationBasis: readonly CalculationBasisTag[];
  realLifeScene: string;
  counterpoint: string;
  checkSignal: string;
  action: string;
  characterLine: string;
  scene: SceneArtwork | null;
  locked: boolean;
  layout: ChapterLayout;
}

export interface MzLoveReportViewModel {
  cover: { title: string; subtitle: string; eyebrow: string; relationshipLabel: string; keywords: readonly string[]; evidenceCount: number; createdAt: string };
  chapters: readonly MzLoveChapterViewModel[];
  redFlags: readonly string[];
  greenFlags: readonly string[];
  actionPlan: MzLoveActionPlan;
  disclaimers: readonly string[];
  progress: { completed: number; total: number };
}

export interface RelationshipFixture { key: string; label: string; report: MzLoveReport }
