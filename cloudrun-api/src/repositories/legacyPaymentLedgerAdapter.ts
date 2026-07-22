import { createHash } from 'node:crypto';
import type {
  Entitlement,
  Payment,
  ReportGenerationJob
} from '../contracts/models.ts';
import { DATA_SCHEMA_VERSION } from '../contracts/models.ts';
import {
  getReportGenerationIdempotencyKey,
  getReportGenerationJobId
} from '../contracts/stateTransitions.ts';
import {
  validateEntitlement,
  validatePayment,
  validateReportGenerationJob
} from '../contracts/validation.ts';
import {
  isProductAvailableForExistingAccess,
  SERVER_PRODUCT_CATALOG,
  type ProductId
} from '../contracts/products.ts';
import {
  assertLegacyProjectionSource,
  LEGACY_SCHEMA_VERSION
} from '../migrations/schemaVersion.ts';

export type LegacyPaymentLedgerSource = Readonly<Record<string, unknown>>;

export type LegacyPaymentLedgerProjection = Readonly<{
  sourceSchemaVersion: typeof LEGACY_SCHEMA_VERSION;
  targetSchemaVersion: typeof DATA_SCHEMA_VERSION;
  requiresWrite: false;
  documentId: string;
  payment: Payment;
  entitlement: Entitlement;
  reportGenerationJob: ReportGenerationJob | null;
}>;

export class LegacyPaymentLedgerAdapterError extends Error {
  readonly code = 'LEGACY_PAYMENT_LEDGER_INVALID';

  constructor(message: string) {
    super(message);
    this.name = 'LegacyPaymentLedgerAdapterError';
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function unwrapFirestoreValue(value: unknown) {
  const record = asRecord(value);

  if (!record) {
    return value;
  }

  if (typeof record.stringValue === 'string') {
    return record.stringValue;
  }

  if (typeof record.timestampValue === 'string') {
    return record.timestampValue;
  }

  if (typeof record.integerValue === 'string' && /^-?\d+$/.test(record.integerValue)) {
    return Number(record.integerValue);
  }

  return value;
}

function fieldsOf(source: LegacyPaymentLedgerSource) {
  return asRecord(source.fields) || source;
}

function readField(source: LegacyPaymentLedgerSource, key: string) {
  return unwrapFirestoreValue(fieldsOf(source)[key]);
}

function optionalString(source: LegacyPaymentLedgerSource, key: string) {
  const value = readField(source, key);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function requiredString(source: LegacyPaymentLedgerSource, key: string) {
  const value = optionalString(source, key);

  if (!value) {
    throw new LegacyPaymentLedgerAdapterError(`${key} is required.`);
  }

  return value;
}

function requiredPositiveInteger(source: LegacyPaymentLedgerSource, key: string) {
  const value = readField(source, key);

  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new LegacyPaymentLedgerAdapterError(`${key} must be a positive integer.`);
  }

  return value;
}

function optionalNonNegativeInteger(
  source: LegacyPaymentLedgerSource,
  key: string,
  fallback = 0
) {
  const value = readField(source, key);

  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : fallback;
}

function assertIsoDateTime(value: string, field: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new LegacyPaymentLedgerAdapterError(`${field} must be an ISO timestamp.`);
  }

  return new Date(timestamp).toISOString();
}

function timestamp(
  source: LegacyPaymentLedgerSource,
  field: string,
  fallback?: string
) {
  const value = optionalString(source, field) || fallback;

  if (!value) {
    throw new LegacyPaymentLedgerAdapterError(`${field} is required.`);
  }

  return assertIsoDateTime(value, field);
}

function firestoreTimestamp(source: LegacyPaymentLedgerSource, key: 'createTime' | 'updateTime') {
  const value = source[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function documentIdFromSource(source: LegacyPaymentLedgerSource) {
  const direct = source.documentId;

  if (typeof direct === 'string' && direct.trim()) {
    return direct.trim();
  }

  if (typeof source.name === 'string' && source.name.trim()) {
    return source.name.split('/').pop() || '';
  }

  return '';
}

function readProductId(source: LegacyPaymentLedgerSource): ProductId {
  const productId = requiredString(source, 'productId');
  const product = SERVER_PRODUCT_CATALOG[productId as ProductId];

  if (!product || !isProductAvailableForExistingAccess(product.status)) {
    throw new LegacyPaymentLedgerAdapterError(
      'productId is not eligible for existing payment or archive recovery.'
    );
  }

  return productId as ProductId;
}

function readEntitlementStatus(source: LegacyPaymentLedgerSource): Entitlement['status'] {
  const value = optionalString(source, 'entitlementStatus');

  if (!value || value === 'active') {
    return 'active';
  }

  if (value === 'revoked') {
    return 'revoked';
  }

  throw new LegacyPaymentLedgerAdapterError('entitlementStatus is unsupported.');
}

function readJobStatus(source: LegacyPaymentLedgerSource) {
  const value = optionalString(source, 'reportGenerationStatus');

  if (!value) {
    return null;
  }

  if (
    value === 'queued' ||
    value === 'generating' ||
    value === 'completed' ||
    value === 'failed' ||
    value === 'cancelled'
  ) {
    return value;
  }

  throw new LegacyPaymentLedgerAdapterError(
    'reportGenerationStatus is unsupported.'
  );
}

export function getLegacyPaymentLedgerDocumentId(paymentId: string) {
  if (typeof paymentId !== 'string' || !paymentId.trim()) {
    throw new LegacyPaymentLedgerAdapterError('paymentId is required.');
  }

  return createHash('sha256')
    .update(`portone:${paymentId.trim()}`)
    .digest('hex');
}

export function getLegacyReportGenerationJobId(entitlementId: string) {
  return getReportGenerationJobId(entitlementId);
}

function projectReportGenerationJob(
  source: LegacyPaymentLedgerSource,
  base: {
    orderId: string;
    entitlementId: string;
    productId: ProductId;
    ownerUserId: string;
    userBinding: string;
    fallbackCreatedAt: string;
    fallbackUpdatedAt: string;
  }
): ReportGenerationJob | null {
  const status = readJobStatus(source);

  if (!status) {
    return null;
  }

  const inputHash = requiredString(source, 'reportInputHash');

  if (!/^[a-f0-9]{64}$/.test(inputHash)) {
    throw new LegacyPaymentLedgerAdapterError(
      'reportInputHash must be lowercase SHA-256.'
    );
  }

  const normalizeOptionalTimestamp = (field: string) => {
    const value = optionalString(source, field);
    return value ? assertIsoDateTime(value, field) : undefined;
  };
  const startedAt = normalizeOptionalTimestamp('reportGenerationStartedAt');
  const completedAt = normalizeOptionalTimestamp('reportGenerationCompletedAt');
  const failedAt = normalizeOptionalTimestamp('reportGenerationFailedAt');
  const cancelledAt = normalizeOptionalTimestamp('reportGenerationCancelledAt');
  const leaseExpiresAt = normalizeOptionalTimestamp('reportGenerationLockExpiresAt');
  const createdAt = timestamp(
    source,
    'reportGenerationStartedAt',
    base.fallbackCreatedAt
  );
  const updatedAt =
    (status === 'completed' && completedAt) ||
    (status === 'failed' && failedAt) ||
    base.fallbackUpdatedAt;

  const jobId = getLegacyReportGenerationJobId(base.entitlementId);
  const storedAttempt = optionalNonNegativeInteger(source, 'reportGenerationAttempt');
  const job: ReportGenerationJob = {
    schemaVersion: DATA_SCHEMA_VERSION,
    jobId,
    orderId: base.orderId,
    entitlementId: base.entitlementId,
    productId: base.productId,
    ownerUserId: base.ownerUserId,
    userBinding: base.userBinding,
    inputHash,
    status,
    attemptCount: status === 'queued' ? storedAttempt : Math.max(1, storedAttempt),
    idempotencyKey: getReportGenerationIdempotencyKey(base.entitlementId, inputHash),
    createdAt,
    updatedAt: assertIsoDateTime(updatedAt, 'updatedAt')
  };

  const leaseId = optionalString(source, 'reportGenerationLockId');

  if (leaseId) job.leaseId = leaseId;
  if (leaseExpiresAt) job.leaseExpiresAt = leaseExpiresAt;
  if (startedAt) job.startedAt = startedAt;
  if (completedAt) job.completedAt = completedAt;
  if (failedAt) job.failedAt = failedAt;
  if (cancelledAt) job.cancelledAt = cancelledAt;
  if (status === 'failed') job.errorCode = 'LEGACY_REPORT_GENERATION_FAILED';

  return Object.freeze(validateReportGenerationJob(job));
}

export function projectLegacyPaymentLedger(
  source: LegacyPaymentLedgerSource,
  options: Readonly<{ documentId?: string }> = {}
): LegacyPaymentLedgerProjection {
  const schemaSource = asRecord(source.fields) || source;
  const sourceSchemaVersion = assertLegacyProjectionSource(
    schemaSource,
    'portonePaymentConfirmations'
  );
  const paymentId = requiredString(source, 'paymentId');
  const expectedDocumentId = getLegacyPaymentLedgerDocumentId(paymentId);
  const suppliedDocumentId = options.documentId?.trim() || documentIdFromSource(source);

  if (suppliedDocumentId && suppliedDocumentId !== expectedDocumentId) {
    throw new LegacyPaymentLedgerAdapterError(
      'Payment ledger document ID does not match paymentId.'
    );
  }

  const storedEntitlementId = optionalString(source, 'entitlementId');

  if (storedEntitlementId && storedEntitlementId !== expectedDocumentId) {
    throw new LegacyPaymentLedgerAdapterError(
      'Stored entitlementId does not match the payment ledger document ID.'
    );
  }

  const orderId = requiredString(source, 'orderId');
  const productId = readProductId(source);
  const amount = requiredPositiveInteger(source, 'amount');
  const currency = requiredString(source, 'currency');

  if (currency !== 'KRW') {
    throw new LegacyPaymentLedgerAdapterError('currency must be KRW.');
  }

  const ownerUserId = requiredString(source, 'userId');
  const userBinding = requiredString(source, 'userBinding');
  const confirmedAt = timestamp(source, 'confirmedAt');
  const createdAt = timestamp(
    source,
    'confirmedAt',
    firestoreTimestamp(source, 'createTime')
  );
  const updatedAt = assertIsoDateTime(
    firestoreTimestamp(source, 'updateTime') || confirmedAt,
    'updatedAt'
  );
  const entitlementIssuedAt = timestamp(
    source,
    'entitlementCreatedAt',
    confirmedAt
  );

  const payment: Payment = {
    schemaVersion: DATA_SCHEMA_VERSION,
    paymentId,
    orderId,
    ownerUserId,
    userBinding,
    productId,
    amount,
    currency: 'KRW',
    storeId: requiredString(source, 'storeId'),
    transactionId: requiredString(source, 'transactionId'),
    provider: 'portone',
    status: 'paid',
    confirmedAt,
    idempotencyKey: expectedDocumentId,
    createdAt,
    updatedAt
  };
  const frozenPayment = Object.freeze(validatePayment(payment));
  const entitlementStatus = readEntitlementStatus(source);
  const entitlement: Entitlement = {
    schemaVersion: DATA_SCHEMA_VERSION,
    entitlementId: expectedDocumentId,
    paymentId,
    orderId,
    productId,
    ownerUserId,
    userBinding,
    status: entitlementStatus,
    issuedAt: entitlementIssuedAt,
    idempotencyKey: expectedDocumentId,
    createdAt: entitlementIssuedAt,
    updatedAt
  };

  const revokedAt = optionalString(source, 'entitlementRevokedAt');
  const revocationReason = optionalString(source, 'entitlementRevocationReason');

  if (revokedAt) entitlement.revokedAt = assertIsoDateTime(revokedAt, 'entitlementRevokedAt');
  if (revocationReason) entitlement.revocationReason = revocationReason;

  const frozenEntitlement = Object.freeze(validateEntitlement(entitlement));
  const reportGenerationJob = projectReportGenerationJob(source, {
    orderId,
    entitlementId: expectedDocumentId,
    productId,
    ownerUserId,
    userBinding,
    fallbackCreatedAt: confirmedAt,
    fallbackUpdatedAt: updatedAt
  });

  return Object.freeze({
    sourceSchemaVersion,
    targetSchemaVersion: DATA_SCHEMA_VERSION,
    requiresWrite: false as const,
    documentId: expectedDocumentId,
    payment: frozenPayment,
    entitlement: frozenEntitlement,
    reportGenerationJob
  });
}
