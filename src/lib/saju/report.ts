import type { ServiceId } from '../../api/mockData';
import type { ReunionReport } from '../reunion/types';

export type ReportKind = 'comprehensive' | 'yearly' | 'love' | 'reunion' | 'marriage' | 'compatibility' | 'career' | 'wealth';
type CardTone = 'default' | 'good' | 'warn';
export type FiveElement = '목' | '화' | '토' | '금' | '수';

export interface PastLifePortrait {
  image: string;
  imageAlt: string;
  eyebrow: string;
  title: string;
  role: string;
  appearance: string[];
  attire: string;
  gaze: string;
  caption: string;
}

export interface PastLifeStoryBeat {
  title: string;
  scene: string;
  goblinLine: string;
  presentEcho: string;
}

export interface PastLifeProfile {
  version: 'past-life-profile-v2';
  seed: number;
  sealName: string;
  archetype: string;
  eraMood: string;
  place: string;
  vocation: string;
  keepsake: string;
  openingLine: string;
  customerFocus: string;
  repeatedScene: string;
  frequentEmotion: string;
  hiddenDesire: string;
  readingTone: string;
  selfPortrait: PastLifePortrait;
  connectionPortrait: PastLifePortrait;
  connectionRole: string;
  firstMeeting: string;
  unfinishedPromise: string;
  finalSeparation: string;
  presentEcho: string;
  evidence: string[];
  storyBeats: PastLifeStoryBeat[];
  disclaimer: string;
}

export interface ReportCard {
  title: string;
  body: string;
  tone?: CardTone;
  badge?: string;
}

export interface ReportDetail {
  summary: string;
  content: string;
  open?: boolean;
}

export interface ReportSection {
  id: string;
  title: string;
  subtitle?: string;
  paragraphs?: string[];
  bullets?: string[];
  cards?: ReportCard[];
  details?: ReportDetail[];
  callout?: {
    title?: string;
    body: string;
  };
  table?: {
    headers: string[];
    rows: string[][];
  };
}

export interface QuestionAnswerBlock {
  question: string;
  title: string;
  analysis: string;
  advice: string[];
}

export interface YearLuckItem {
  year: number;
  ganzhi: string;
  score: number;
  headline: string;
  summary: string;
  focus: string;
  warning: string;
}

export interface MonthLuckItem {
  year: number;
  month: number;
  ganzhi: string;
  score: number;
  summary: string;
  focus: string;
  warning: string;
  validFrom?: string;
  validTo?: string;
}

export interface FortuneWindow {
  name: string;
  range: string;
  summary: string;
  focus: string;
  caution: string;
}

export interface ActionPlan {
  title: string;
  priorities: string[];
  dos: string[];
  avoids: string[];
  luckyDays: { day: number; reason: string }[];
  unluckyDays: { day: number; reason: string }[];
}

export interface VisibleTenGodReading {
  pillar: string;
  stem: string;
  stemHanja: string;
  stemTenGod: string;
  branch: string;
  branchHanja: string;
  branchMainStem: string;
  branchTenGod: string;
  reading: string;
}

export interface ReportQualityScoreItem {
  label: string;
  score: number;
  max: number;
}

export interface ReportQualityAudit {
  score: number;
  status: 'pass' | 'warn';
  items: ReportQualityScoreItem[];
  warnings: string[];
  repeatedSentences: string[];
  bannedTerms: string[];
  typoSignals: string[];
}

export interface ReportEngineMeta {
  engineVersion: string;
  validationStatus: string;
  calendarVersion: string;
  interpretationVersion: string;
  interactionVersion: string;
  calculationPrecision: 'exact-minute' | 'legacy-range' | 'unknown';
  scenarioCount: number;
  dayBoundaryPolicy: 'civil-midnight' | 'late-zi-next-day';
  trueSolarTime: {
    requested: boolean;
    applied: boolean;
    correctionMinutes: number | null;
  };
  evidenceCount: number;
  confidence: number | null;
  releaseDecision: 'eligible' | 'manual-review-required' | 'blocked';
  releaseAuditVersion: string;
  reproducibilityFingerprint: string;
  evidenceCoverage: {
    score: number;
    passed: number;
    total: number;
  };
  externalCalendarStatus:
    | 'matched'
    | 'mismatched'
    | 'verified-date-only'
    | 'not-comparable-policy'
    | 'not-configured'
    | 'failed';
  releaseBlockers: string[];
  reviewFlags: string[];
  uncertainty: string[];
  helpfulElementSource: 'expert-consensus' | 'legacy-fallback';
}

export interface SajuReportData {
  serviceId: ServiceId;
  kind: ReportKind;
  title: string;
  subtitle: string;
  badge: string;
  serialNumber: string;
  createdAt: string;
  birthLabel: string;
  questionPreview: string;
  customerName: string;
  zodiac: string;
  dayMaster: string;
  dayMasterElement: FiveElement;
  strengthLabel: string;
  helpfulElements: FiveElement[];
  cautiousElements: FiveElement[];
  gyeokguk: string;
  heroNote: string;
  keyTakeaways: ReportCard[];
  currentDayun: FortuneWindow;
  nextDayun: FortuneWindow;
  legalNotice: string[];
  pillars: {
    year: string;
    month: string;
    day: string;
    hour: string | null;
  };
  fiveElements: Array<{ label: FiveElement; value: number; color: string }>;
  tenGods: Array<{ label: string; value: number }>;
  visibleTenGods: VisibleTenGodReading[];
  tenGodBasisNote: string;
  metaGrid: Array<{ label: string; value: string }>;
  summary: {
    title: string;
    analysis: string[];
    advice: string[];
  };
  questionAnswers: QuestionAnswerBlock[];
  sections: ReportSection[];
  yearLuck: YearLuckItem[];
  monthLuck: MonthLuckItem[];
  actionPlan: ActionPlan;
  qualityAudit: ReportQualityAudit;
  engineMeta?: ReportEngineMeta;
  reunionStrategy?: ReunionReport;
  pastLifeProfile?: PastLifeProfile;
}
