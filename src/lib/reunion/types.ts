import type { IntakeFormData } from '../../api/mockData';

export const REUNION_REPORT_VERSION = 'reunion-report-v1.0.0' as const;
export const REUNION_RULE_VERSION = 'reunion-policy-2026.07' as const;

export type ReunionRequesterRole = 'self' | 'authorized-helper';
export type ReunionBirthAccuracy = 'documented' | 'remembered' | 'approximate' | 'unknown';
export type ReunionBreakupInitiator = 'self' | 'partner' | 'mutual' | 'unclear';
export type ReunionContactMood = 'warm' | 'neutral' | 'cold' | 'conflict' | 'unknown';
export type ReunionContactFrequency = 'none' | 'rare' | 'weekly' | 'frequent';
export type ReunionBlockState = 'none' | 'self-blocked' | 'partner-blocked' | 'mutual' | 'unknown';
export type ReunionNewRelationshipState = 'none' | 'self' | 'partner' | 'both' | 'unknown';
export type ReunionDistanceState = 'same-area' | 'domestic-distance' | 'overseas' | 'unknown';
export type ReunionDesiredOutcome = 'reunion' | 'conversation' | 'apology' | 'closure' | 'undecided';
export type ReunionReadinessLevel = 'ready' | 'shaky' | 'not-ready';

export const reunionBreakupReasonValues = [
  'communication',
  'trust',
  'distance',
  'family',
  'work',
  'money',
  'values',
  'marriage',
  'children',
  'infidelity',
  'emotional-exhaustion',
  'unclear'
] as const;
export type ReunionBreakupReason = (typeof reunionBreakupReasonValues)[number];

export const reunionQuestionValues = [
  'contact-temperature',
  'contact-timing',
  'contact-first',
  'reply-strategy',
  'meeting-strategy',
  'reunion-index',
  'recurrence-risk',
  'long-term-fit'
] as const;
export type ReunionQuestionId = (typeof reunionQuestionValues)[number];

export interface ReunionSafetySignals {
  explicitNoContact: boolean;
  stalkingOrReport: boolean;
  violence: boolean;
  threats: boolean;
  coerciveControl: boolean;
  financialExploitation: boolean;
  selfHarmPressure: boolean;
  blockCircumventionAttempt: boolean;
  disruptingNewRelationship: boolean;
}

export interface ReunionReadiness {
  accountabilityTaken: boolean;
  breakupCauseChanged: boolean;
  canAcceptNoReply: boolean;
  canRespectBoundary: boolean;
  supportAvailable: boolean;
  level: ReunionReadinessLevel;
}

export interface ReunionRelationshipFacts {
  relationshipStartDate: string;
  breakupDate: string;
  relationshipLengthMonths: number | null;
  daysSinceBreakup: number | null;
  breakupInitiator: ReunionBreakupInitiator;
  breakupReasons: ReunionBreakupReason[];
  breakupReasonDetail: string;
  pastReunionCount: number;
  repeatedCause: boolean;
  lastContactDate: string;
  daysSinceLastContact: number | null;
  lastContactMood: ReunionContactMood;
  contactFrequency: ReunionContactFrequency;
  blockState: ReunionBlockState;
  newRelationship: ReunionNewRelationshipState;
  distance: ReunionDistanceState;
  familyObstacle: boolean;
  workObstacle: boolean;
  moneyObstacle: boolean;
  trustObstacle: boolean;
  valuesObstacle: boolean;
  marriageObstacle: boolean;
  childrenObstacle: boolean;
}

export interface ReunionContext {
  schemaVersion: 'reunion-intake-v1';
  analysisDate: string;
  requesterRole: ReunionRequesterRole;
  adultConfirmed: boolean;
  dataUseConsent: boolean;
  dataAuthorityConfirmed: boolean;
  selfBirthAccuracy: ReunionBirthAccuracy;
  partnerBirthAccuracy: ReunionBirthAccuracy;
  partnerBirthKnown: boolean;
  facts: ReunionRelationshipFacts;
  safety: ReunionSafetySignals;
  readiness: ReunionReadiness;
  selectedQuestions: ReunionQuestionId[];
  customQuestion: string;
  messageDraft: string;
  desiredOutcome: ReunionDesiredOutcome;
  fearedOutcome: string;
  attemptedContactSummary: string;
}

export type ReunionIntakeData = IntakeFormData & {
  reunion: ReunionContext;
};

export type SafetyGateStatus =
  | 'ANALYSIS_BLOCKED'
  | 'CONTACT_PROHIBITED'
  | 'PREPARATION_REQUIRED'
  | 'CONTACT_ELIGIBLE';

export interface SafetyGateDecision {
  status: SafetyGateStatus;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  summary: string;
  reasonCodes: string[];
  contactAdviceAllowed: boolean;
  timingAllowed: boolean;
  messageScriptAllowed: boolean;
  immediateActions: string[];
  emergencyNotice?: string;
}

export type EvidenceSource = 'SAJU' | 'RELATIONSHIP_FACT' | 'BEHAVIOR' | 'SAFETY' | 'SYSTEM_LIMIT';
export type EvidenceDirection = 'SUPPORTS' | 'OPPOSES' | 'NEUTRAL';

export interface ReunionEvidenceNode {
  id: string;
  source: EvidenceSource;
  direction: EvidenceDirection;
  label: string;
  detail: string;
  confidence: number;
  verified: boolean;
}

export const reunionMetricIds = [
  'emotional-residue',
  'incoming-contact',
  'outgoing-suitability',
  'reply',
  'meeting',
  'relationship-redefinition',
  'reunion',
  'sustainability-30',
  'sustainability-90',
  'long-term',
  'recurrence-risk',
  'contact-harm-risk',
  'reality-obstacles',
  'readiness'
] as const;
export type ReunionMetricId = (typeof reunionMetricIds)[number];
export type ReunionMetricState = 'AVAILABLE' | 'WITHHELD_SAFETY' | 'INSUFFICIENT_DATA';

export interface ReunionMetric {
  id: ReunionMetricId;
  label: string;
  score: number | null;
  state: ReunionMetricState;
  band: 'very-low' | 'low' | 'guarded' | 'balanced' | 'high' | 'very-high' | 'withheld';
  summary: string;
  evidenceIds: string[];
  counterEvidenceIds: string[];
  realityChecks: string[];
  actions: string[];
  prohibitedActions: string[];
  changeConditions: string[];
}

export interface ReunionAnswerFirst {
  question: string;
  answer: string;
  confidence: 'high' | 'medium' | 'limited';
  evidenceIds: string[];
  counterEvidenceIds: string[];
  nextAction: string;
}

export type ReunionChoiceId = 'CONTACT_NOW' | 'WAIT' | 'NO_CONTACT';

export interface ReunionChoice {
  id: ReunionChoiceId;
  label: string;
  recommendation: 'PRIMARY' | 'SECONDARY' | 'NOT_RECOMMENDED' | 'REQUIRED';
  upside: string;
  downside: string;
  requirements: string[];
  stopConditions: string[];
}

export interface ReunionContactWindow {
  id: string;
  rank: 1 | 2 | 3;
  range: string;
  sourceMonth: string;
  score: number;
  purpose: 'LIGHT_CHECK_IN' | 'APOLOGY' | 'MEETING_PROPOSAL';
  channel: string;
  lengthGuide: string;
  firstLine: string;
  waitAfterSending: string;
  evidenceIds: string[];
  cautions: string[];
}

export interface ReunionMessageReview {
  originalProvided: boolean;
  riskFlags: string[];
  recommendedChannel: string;
  lengthGuide: string;
  firstLine: string;
  revisedMessage: string;
  doNotSend: string[];
}

export interface ReunionReplyBranch {
  id: string;
  signal: string;
  interpretation: string;
  response: string;
  wait: string;
  stop: boolean;
}

export interface ReunionPlanPhase {
  range: string;
  goal: string;
  actions: string[];
  evidenceToObserve: string[];
  stopRules: string[];
}

export interface ReunionCalculationComponent {
  id: 'MANSE' | 'ZIWEI' | 'RELATIONSHIP' | 'SAFETY' | 'SCORING';
  label: string;
  status: 'VERIFIED_INTERNAL' | 'UNVERIFIED' | 'USER_REPORTED' | 'POLICY_ENFORCED';
  version: string;
  note: string;
  usedForScoring: boolean;
}

export interface ReunionReportAudit {
  passed: boolean;
  checks: Array<{ id: string; label: string; passed: boolean; detail: string }>;
  bannedClaimHits: string[];
}

export interface ReunionReport {
  version: typeof REUNION_REPORT_VERSION;
  ruleVersion: typeof REUNION_RULE_VERSION;
  generatedAt: string;
  analysisDate: string;
  customerName: string;
  partnerName: string;
  headline: string;
  directVerdict: string;
  safety: SafetyGateDecision;
  answerFirst: ReunionAnswerFirst[];
  metrics: ReunionMetric[];
  choices: ReunionChoice[];
  contactWindows: ReunionContactWindow[];
  messageReview: ReunionMessageReview;
  replyTree: ReunionReplyBranch[];
  plan30: ReunionPlanPhase[];
  plan90: ReunionPlanPhase[];
  evidence: ReunionEvidenceNode[];
  components: ReunionCalculationComponent[];
  birthChart: {
    self: {
      pillars: { year: string; month: string; day: string; hour: string | null };
      dayMaster: string;
      element: string;
      precision: string;
    };
    partner: {
      available: boolean;
      precision: string;
    };
    compatibilitySummary: string;
  };
  confidence: {
    score: number;
    label: '높음' | '중간' | '제한';
    reasons: string[];
  };
  limitations: string[];
  audit: ReunionReportAudit;
}

export const EMPTY_REUNION_SAFETY: ReunionSafetySignals = {
  explicitNoContact: false,
  stalkingOrReport: false,
  violence: false,
  threats: false,
  coerciveControl: false,
  financialExploitation: false,
  selfHarmPressure: false,
  blockCircumventionAttempt: false,
  disruptingNewRelationship: false
};

export function createEmptyReunionContext(today = new Date().toISOString().slice(0, 10)): ReunionContext {
  return {
    schemaVersion: 'reunion-intake-v1',
    analysisDate: today,
    requesterRole: 'self',
    adultConfirmed: false,
    dataUseConsent: false,
    dataAuthorityConfirmed: false,
    selfBirthAccuracy: 'remembered',
    partnerBirthAccuracy: 'unknown',
    partnerBirthKnown: false,
    facts: {
      relationshipStartDate: '',
      breakupDate: '',
      relationshipLengthMonths: null,
      daysSinceBreakup: null,
      breakupInitiator: 'unclear',
      breakupReasons: [],
      breakupReasonDetail: '',
      pastReunionCount: 0,
      repeatedCause: false,
      lastContactDate: '',
      daysSinceLastContact: null,
      lastContactMood: 'unknown',
      contactFrequency: 'none',
      blockState: 'unknown',
      newRelationship: 'unknown',
      distance: 'unknown',
      familyObstacle: false,
      workObstacle: false,
      moneyObstacle: false,
      trustObstacle: false,
      valuesObstacle: false,
      marriageObstacle: false,
      childrenObstacle: false
    },
    safety: { ...EMPTY_REUNION_SAFETY },
    readiness: {
      accountabilityTaken: false,
      breakupCauseChanged: false,
      canAcceptNoReply: false,
      canRespectBoundary: true,
      supportAvailable: false,
      level: 'shaky'
    },
    selectedQuestions: ['reunion-index', 'contact-timing', 'recurrence-risk'],
    customQuestion: '',
    messageDraft: '',
    desiredOutcome: 'undecided',
    fearedOutcome: '',
    attemptedContactSummary: ''
  };
}
