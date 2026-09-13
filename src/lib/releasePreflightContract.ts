export const RELEASE_PREFLIGHT_STATUSES = [
  'auto-eligible',
  'manual-review-required',
  'blocked'
] as const;

export type ReleasePreflightStatus = (typeof RELEASE_PREFLIGHT_STATUSES)[number];

export type ReleasePreflightResult = {
  serviceId: 'general-signature';
  status: ReleasePreflightStatus;
  reasons: string[];
  policyVersion: string;
  inputFingerprint: string;
  calculationFingerprint: string;
};

export function isReleasePreflightResult(value: unknown): value is ReleasePreflightResult {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ReleasePreflightResult>;
  return candidate.serviceId === 'general-signature' &&
    RELEASE_PREFLIGHT_STATUSES.includes(candidate.status as ReleasePreflightStatus) &&
    Array.isArray(candidate.reasons) &&
    candidate.reasons.every((reason) => typeof reason === 'string') &&
    typeof candidate.policyVersion === 'string' &&
    typeof candidate.inputFingerprint === 'string' &&
    typeof candidate.calculationFingerprint === 'string';
}
