import { createHash } from 'node:crypto';

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

function requireSha256(value: string, field: string) {
  if (!SHA256_HEX_PATTERN.test(value)) {
    throw new TypeError(`${field} must be a lowercase SHA-256 value.`);
  }
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function getReportGenerationJobId(entitlementId: string) {
  requireSha256(entitlementId, 'entitlementId');
  return sha256(`unwoldang:report-job:v1:${entitlementId}`);
}

export function getReportGenerationIdempotencyKey(
  entitlementId: string,
  inputHash: string
) {
  requireSha256(entitlementId, 'entitlementId');
  requireSha256(inputHash, 'inputHash');
  return sha256(
    `unwoldang:report-generation:v1:${entitlementId}:${inputHash}`
  );
}
