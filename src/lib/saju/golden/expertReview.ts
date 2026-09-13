export const expertAgreementStatuses = [
  'pending',
  'agreed',
  'partially-agreed',
  'disagreed',
  'needs-third-review'
] as const;

export interface ExpertIdentity {
  reviewerId: string;
  displayName: string;
  credentials: string;
  reviewedAt: string | null;
}

export interface GeneralSignatureExpertReview {
  fixtureId: string;
  expertA: ExpertIdentity | null;
  expertB: ExpertIdentity | null;
  strengthAssessment: string | null;
  usefulElement: string | null;
  favorableElements: string[];
  cautiousElements: string[];
  reasoning: string;
  agreementStatus: (typeof expertAgreementStatuses)[number];
  disagreementNotes: string;
  interpretationPolicyVersion: string;
}

export function createPendingExpertReview(fixtureId: string): GeneralSignatureExpertReview {
  return {
    fixtureId,
    expertA: null,
    expertB: null,
    strengthAssessment: null,
    usefulElement: null,
    favorableElements: [],
    cautiousElements: [],
    reasoning: '',
    agreementStatus: 'pending',
    disagreementNotes: '',
    interpretationPolicyVersion: 'pending-expert-policy'
  };
}
