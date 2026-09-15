export const REUNION_CONTEXT_VERSION = 'reunion-context-v1' as const;
export const REUNION_VIEW_MODEL_VERSION = 'reunion-view-model-v1' as const;

export const reunionBreakupDurationValues = ['under1m', 'oneTo3m', 'threeTo6m', 'sixTo12m', 'over1y', 'unknown'] as const;
export type ReunionBreakupDuration = (typeof reunionBreakupDurationValues)[number];

export const reunionContactStatusValues = ['no-contact', 'occasional', 'active', 'blocked', 'unknown'] as const;
export type ReunionContactStatus = (typeof reunionContactStatusValues)[number];

export const reunionDesiredOutcomeValues = ['reconnect', 'closure', 'clarity', 'unsure'] as const;
export type ReunionDesiredOutcome = (typeof reunionDesiredOutcomeValues)[number];

export interface ReunionContext {
  schemaVersion: typeof REUNION_CONTEXT_VERSION;
  breakupDuration: ReunionBreakupDuration;
  contactStatus: ReunionContactStatus;
  lastContactAt?: string;
  breakupReason: string;
  desiredOutcome: ReunionDesiredOutcome;
  notes: string;
  consentToUsePartnerData: boolean;
}

export type ReunionContextInput = Omit<Partial<ReunionContext>, 'schemaVersion'> & {
  schemaVersion?: typeof REUNION_CONTEXT_VERSION;
};

export type ReunionValidationField = 'context' | 'schemaVersion' | 'breakupDuration' | 'contactStatus' | 'lastContactAt' | 'breakupReason' | 'desiredOutcome' | 'notes' | 'consentToUsePartnerData';

export interface ReunionValidationError {
  field: ReunionValidationField;
  message: string;
}

export interface ReunionValidationResult {
  valid: boolean;
  errors: ReunionValidationError[];
}

export type ReunionEvidenceSource = 'saju' | 'compatibility';
export type ReunionEvidenceTendency = 'supportive' | 'conditional' | 'tension' | 'neutral' | 'unknown';
export type ReunionConfidence = 'supported' | 'limited' | 'unknown';

/** A statement copied from a deterministic engine result, never inferred from free text. */
export interface ReunionDeterministicEvidence {
  id: string;
  source: ReunionEvidenceSource;
  sourcePath: string;
  label: string;
  statement: string;
  tendency: ReunionEvidenceTendency;
  confidence: ReunionConfidence;
  uncertainty: string[];
}

/** A display-only fact supplied by the user. It is never promoted to calculated evidence. */
export interface ReunionUserContextItem {
  id: keyof Pick<ReunionContext, 'breakupDuration' | 'contactStatus' | 'lastContactAt' | 'breakupReason' | 'desiredOutcome' | 'notes'>;
  label: string;
  value: string;
  source: 'user-provided';
  verification: 'unverified';
}

export interface ReunionQualitativeFinding {
  id: 'relationship-pattern' | 'timing-context';
  label: string;
  statement: string;
  confidence: ReunionConfidence;
  evidenceIds: string[];
}

export interface ReunionViewModel {
  version: typeof REUNION_VIEW_MODEL_VERSION;
  status: ReunionConfidence;
  headline: string;
  summary: string;
  findings: ReunionQualitativeFinding[];
  deterministicEvidence: ReunionDeterministicEvidence[];
  userContext: ReunionUserContextItem[];
  limitations: string[];
  contactBoundary: { status: 'standard' | 'withheld'; message: string };
}
