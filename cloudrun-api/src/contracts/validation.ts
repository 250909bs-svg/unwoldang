import {
  getProductCatalogHash,
  getProductCatalogSnapshotId
} from './catalogIdentity.ts';
import {
  ADMIN_AUDIT_EVENT_STATUSES,
  DATA_SCHEMA_VERSION,
  ENTITLEMENT_STATUSES,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  PRODUCT_CATALOG_SNAPSHOT_STATUSES,
  REPORT_ARCHIVE_STATUSES,
  REPORT_GENERATION_JOB_STATUSES,
  USER_ACCOUNT_STATUSES,
  type AdminAuditEvent,
  type Entitlement,
  type Order,
  type Payment,
  type ProductCatalogItemSnapshot,
  type ProductCatalogSnapshot,
  type ReportArchive,
  type ReportGenerationJob,
  type UserAccount,
  type VersionedEntity
} from './models.ts';
import {
  isProductStatus,
  SERVER_PRODUCT_CATALOG,
  SERVER_PRODUCT_DISPLAY_NAMES,
  type ProductId,
  type ProductStatus
} from './products.ts';
import {
  getReportGenerationIdempotencyKey,
  getReportGenerationJobId
} from './resourceIdentity.ts';

export const ORDER_ID_PATTERN = /^UW-[A-Za-z0-9._-]{12,116}$/;
export const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

export class DataContractError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = 'DataContractError';
    this.code = code;
    this.status = status;
  }
}

function fail(code: string, message: string, status = 400): never {
  throw new DataContractError(code, message, status);
}

function asRecord(value: unknown, model: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('DATA_CONTRACT_INVALID_SHAPE', `${model} must be an object.`);
  }

  return value as Record<string, unknown>;
}

const VERSIONED_ENTITY_FIELDS = [
  'schemaVersion',
  'createdAt',
  'updatedAt',
  'idempotencyKey'
] as const;

function assertOnlyFields(
  record: Record<string, unknown>,
  model: string,
  fields: readonly string[],
  includeVersionedFields = true
) {
  const allowed = new Set(includeVersionedFields ? [...VERSIONED_ENTITY_FIELDS, ...fields] : fields);
  if (Object.keys(record).some((field) => !allowed.has(field))) {
    fail('DATA_CONTRACT_UNKNOWN_FIELD', `${model} contains an unsupported field.`);
  }
}

function requireString(
  record: Record<string, unknown>,
  field: string,
  options: { min?: number; max?: number; pattern?: RegExp } = {}
) {
  const value = record[field];
  const min = options.min ?? 1;
  const max = options.max ?? 512;

  if (
    typeof value !== 'string' ||
    value.trim() !== value ||
    value.length < min ||
    value.length > max ||
    /[\u0000-\u001f\u007f]/.test(value) ||
    (options.pattern && !options.pattern.test(value))
  ) {
    fail('DATA_CONTRACT_INVALID_FIELD', `${field} has an invalid value.`);
  }

  return value;
}

function optionalString(record: Record<string, unknown>, field: string, max = 512) {
  if (record[field] === undefined) {
    return undefined;
  }

  return requireString(record, field, { max });
}

function requirePositiveAmount(record: Record<string, unknown>, field = 'amount') {
  const value = record[field];

  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    fail('DATA_CONTRACT_INVALID_FIELD', `${field} must be a positive safe integer.`);
  }

  return value;
}

function requireNonNegativeInteger(record: Record<string, unknown>, field: string) {
  const value = record[field];

  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    fail('DATA_CONTRACT_INVALID_FIELD', `${field} must be a non-negative safe integer.`);
  }

  return value;
}

function requireOneOf<T extends string>(
  record: Record<string, unknown>,
  field: string,
  values: readonly T[]
): T {
  const value = record[field];

  if (typeof value !== 'string' || !values.includes(value as T)) {
    fail('DATA_CONTRACT_INVALID_FIELD', `${field} has an unsupported value.`);
  }

  return value as T;
}

export function isOrderId(value: unknown): value is string {
  return typeof value === 'string' && ORDER_ID_PATTERN.test(value);
}

export function isSha256Hex(value: unknown): value is string {
  return typeof value === 'string' && SHA256_HEX_PATTERN.test(value);
}

export function isIsoDateTime(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

export function isKnownProductId(value: unknown): value is ProductId {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(SERVER_PRODUCT_CATALOG, value)
  );
}

function requireOrderId(record: Record<string, unknown>, field = 'orderId') {
  const value = record[field];

  if (!isOrderId(value)) {
    fail('DATA_CONTRACT_INVALID_ORDER_ID', `${field} has an invalid order ID.`);
  }

  return value;
}

function requireSha256(record: Record<string, unknown>, field: string) {
  const value = record[field];

  if (!isSha256Hex(value)) {
    fail('DATA_CONTRACT_INVALID_HASH', `${field} must be a lowercase SHA-256 value.`);
  }

  return value;
}

function requireTimestamp(record: Record<string, unknown>, field: string) {
  const value = record[field];

  if (!isIsoDateTime(value)) {
    fail('DATA_CONTRACT_INVALID_TIMESTAMP', `${field} must be a canonical UTC ISO timestamp.`);
  }

  return value;
}

function optionalTimestamp(record: Record<string, unknown>, field: string) {
  if (record[field] === undefined) {
    return undefined;
  }

  return requireTimestamp(record, field);
}

function requireProductId(record: Record<string, unknown>, field = 'productId') {
  const value = record[field];

  if (!isKnownProductId(value)) {
    fail('PRODUCT_UNKNOWN', `${field} is not in the server product catalog.`);
  }

  return value;
}

function validateVersionedEntity(
  record: Record<string, unknown>,
  model: string
): asserts record is Record<string, unknown> & VersionedEntity {
  if (record.schemaVersion !== DATA_SCHEMA_VERSION) {
    fail('DATA_CONTRACT_SCHEMA_VERSION_UNSUPPORTED', `${model} schemaVersion must be 1.`);
  }

  const createdAt = requireTimestamp(record, 'createdAt');
  const updatedAt = requireTimestamp(record, 'updatedAt');
  requireString(record, 'idempotencyKey', { max: 512 });

  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    fail('DATA_CONTRACT_INVALID_TIMESTAMP', `${model} updatedAt cannot precede createdAt.`);
  }
}

function validateOwner(record: Record<string, unknown>) {
  requireString(record, 'ownerUserId', { max: 128 });
  requireString(record, 'userBinding', { min: 16, max: 256 });
}

function validateCatalogItem(
  raw: unknown,
  enforceCurrentCatalog: boolean
): ProductCatalogItemSnapshot {
  const item = asRecord(raw, 'ProductCatalogItemSnapshot');
  assertOnlyFields(item, 'ProductCatalogItemSnapshot', [
    'productId',
    'displayName',
    'amount',
    'currency',
    'status'
  ], false);
  const productId = requireProductId(item);
  const displayName = requireString(item, 'displayName', { max: 160 });
  requirePositiveAmount(item);

  if (item.currency !== 'KRW' || !isProductStatus(item.status)) {
    fail('DATA_CONTRACT_INVALID_FIELD', 'Product catalog currency must be KRW.');
  }

  const expected = SERVER_PRODUCT_CATALOG[productId];

  if (
    enforceCurrentCatalog &&
    (item.amount !== expected.amount ||
      item.status !== expected.status ||
      displayName !== SERVER_PRODUCT_DISPLAY_NAMES[productId])
  ) {
    fail(
      'PRODUCT_CATALOG_SNAPSHOT_MISMATCH',
      'Product catalog snapshot does not match the authoritative server catalog.'
    );
  }

  return item as unknown as ProductCatalogItemSnapshot;
}

export function validateUserAccount(value: unknown): UserAccount {
  const record = asRecord(value, 'UserAccount');
  assertOnlyFields(record, 'UserAccount', [
    'userId',
    'ownerUserId',
    'productId',
    'provider',
    'providerUserId',
    'status',
    'nickname',
    'email',
    'avatarUrl',
    'lastAuthenticatedAt'
  ]);
  validateVersionedEntity(record, 'UserAccount');
  const userId = requireString(record, 'userId', { max: 128 });
  const ownerUserId = requireString(record, 'ownerUserId', { max: 128 });

  if (ownerUserId !== userId || record.productId !== null || record.provider !== 'kakao') {
    fail('DATA_CONTRACT_INVALID_FIELD', 'UserAccount ownership or provider is invalid.');
  }

  requireString(record, 'providerUserId', { max: 128 });
  requireOneOf(record, 'status', USER_ACCOUNT_STATUSES);
  optionalString(record, 'nickname', 120);
  optionalString(record, 'email', 320);
  optionalString(record, 'avatarUrl', 2_048);
  requireTimestamp(record, 'lastAuthenticatedAt');

  if (
    record.status === 'anonymized' &&
    (record.nickname !== undefined || record.email !== undefined || record.avatarUrl !== undefined)
  ) {
    fail('USER_ACCOUNT_PII_NOT_ANONYMIZED', 'An anonymized account cannot retain profile PII.');
  }

  return record as unknown as UserAccount;
}

export function validateProductCatalogSnapshot(value: unknown): ProductCatalogSnapshot {
  const record = asRecord(value, 'ProductCatalogSnapshot');
  assertOnlyFields(record, 'ProductCatalogSnapshot', [
    'catalogSnapshotId',
    'ownerUserId',
    'productId',
    'status',
    'effectiveAt',
    'products',
    'catalogHash'
  ]);
  validateVersionedEntity(record, 'ProductCatalogSnapshot');
  requireSha256(record, 'catalogSnapshotId');
  requireSha256(record, 'catalogHash');
  requireTimestamp(record, 'effectiveAt');
  const status = requireOneOf(record, 'status', PRODUCT_CATALOG_SNAPSHOT_STATUSES);

  if (record.ownerUserId !== null || record.productId !== null || !Array.isArray(record.products)) {
    fail('DATA_CONTRACT_INVALID_FIELD', 'ProductCatalogSnapshot ownership or products are invalid.');
  }

  if (record.products.length === 0) {
    fail(
      'PRODUCT_CATALOG_SNAPSHOT_MISMATCH',
      'Product catalog snapshot must contain at least one product.'
    );
  }

  const products = record.products.map((product) =>
    validateCatalogItem(product, status === 'current')
  );
  const expectedIds = Object.keys(SERVER_PRODUCT_CATALOG).sort();
  const actualIds = products.map((product) => product.productId).sort();
  const expectedCatalogHash = getProductCatalogHash(products);
  const expectedSnapshotId = getProductCatalogSnapshotId(
    expectedCatalogHash,
    record.effectiveAt as string
  );

  if (
    record.catalogHash !== expectedCatalogHash ||
    record.catalogSnapshotId !== expectedSnapshotId
  ) {
    fail(
      'PRODUCT_CATALOG_SNAPSHOT_IDENTITY_MISMATCH',
      'Product catalog snapshot hashes do not match its canonical content.'
    );
  }

  if (new Set(actualIds).size !== actualIds.length) {
    fail(
      'PRODUCT_CATALOG_SNAPSHOT_MISMATCH',
      'Product catalog snapshot cannot contain duplicate product IDs.'
    );
  }

  if (
    status === 'current' &&
    (actualIds.length !== expectedIds.length ||
      actualIds.some((productId, index) => productId !== expectedIds[index]))
  ) {
    fail(
      'PRODUCT_CATALOG_SNAPSHOT_MISMATCH',
      'Product catalog snapshot must contain each server product exactly once.'
    );
  }

  return record as unknown as ProductCatalogSnapshot;
}

export function validateOrder(value: unknown): Order {
  const record = asRecord(value, 'Order');
  assertOnlyFields(record, 'Order', [
    'orderId',
    'ownerUserId',
    'userBinding',
    'productId',
    'catalogSnapshotId',
    'amount',
    'currency',
    'status',
    'paidAt',
    'failedAt',
    'cancelledAt',
    'refundedAt'
  ]);
  validateVersionedEntity(record, 'Order');
  requireOrderId(record);
  validateOwner(record);
  requireProductId(record);
  requireSha256(record, 'catalogSnapshotId');
  requirePositiveAmount(record);

  if (record.currency !== 'KRW') {
    fail('DATA_CONTRACT_INVALID_FIELD', 'Order currency must be KRW.');
  }

  const status = requireOneOf(record, 'status', ORDER_STATUSES);
  optionalTimestamp(record, 'paidAt');
  optionalTimestamp(record, 'failedAt');
  optionalTimestamp(record, 'cancelledAt');
  optionalTimestamp(record, 'refundedAt');

  const requiredTimestampByStatus: Partial<Record<typeof status, string>> = {
    paid: 'paidAt',
    failed: 'failedAt',
    cancelled: 'cancelledAt',
    refunded: 'refundedAt'
  };
  const requiredTimestamp = requiredTimestampByStatus[status];

  if (requiredTimestamp) {
    requireTimestamp(record, requiredTimestamp);
  }

  const allowedTimestampsByStatus: Record<typeof status, readonly string[]> = {
    created: [],
    pending: [],
    paid: ['paidAt'],
    failed: ['failedAt'],
    cancelled: ['cancelledAt'],
    refunded: ['paidAt', 'refundedAt']
  };

  if (status === 'refunded') {
    requireTimestamp(record, 'paidAt');
  }

  ['paidAt', 'failedAt', 'cancelledAt', 'refundedAt'].forEach((field) => {
    if (
      record[field] !== undefined &&
      !allowedTimestampsByStatus[status].includes(field)
    ) {
      fail('DATA_CONTRACT_STATE_TIMESTAMP_CONFLICT', `${field} conflicts with Order status ${status}.`);
    }
  });

  return record as unknown as Order;
}

export function validatePayment(value: unknown): Payment {
  const record = asRecord(value, 'Payment');
  assertOnlyFields(record, 'Payment', [
    'paymentId',
    'orderId',
    'ownerUserId',
    'userBinding',
    'productId',
    'amount',
    'currency',
    'storeId',
    'transactionId',
    'provider',
    'status',
    'approvedAt',
    'confirmedAt',
    'refundedAt'
  ]);
  validateVersionedEntity(record, 'Payment');
  requireOrderId(record, 'paymentId');
  requireOrderId(record, 'orderId');
  validateOwner(record);
  requireProductId(record);
  requirePositiveAmount(record);
  requireString(record, 'storeId', { max: 256 });
  requireString(record, 'transactionId', { max: 256 });

  if (record.currency !== 'KRW' || record.provider !== 'portone') {
    fail('DATA_CONTRACT_INVALID_FIELD', 'Payment currency or provider is invalid.');
  }

  const status = requireOneOf(record, 'status', PAYMENT_STATUSES);
  optionalTimestamp(record, 'approvedAt');
  optionalTimestamp(record, 'confirmedAt');
  optionalTimestamp(record, 'refundedAt');

  if (status === 'paid') {
    requireTimestamp(record, 'confirmedAt');
  }

  if (status === 'refunded') {
    requireTimestamp(record, 'refundedAt');
    requireTimestamp(record, 'confirmedAt');
  }

  const allowedTimestampsByStatus: Record<typeof status, readonly string[]> = {
    pending: [],
    paid: ['approvedAt', 'confirmedAt'],
    failed: [],
    cancelled: [],
    refunded: ['approvedAt', 'confirmedAt', 'refundedAt']
  };

  ['approvedAt', 'confirmedAt', 'refundedAt'].forEach((field) => {
    if (
      record[field] !== undefined &&
      !allowedTimestampsByStatus[status].includes(field)
    ) {
      fail(
        'DATA_CONTRACT_STATE_TIMESTAMP_CONFLICT',
        `${field} conflicts with Payment status ${status}.`
      );
    }
  });

  return record as unknown as Payment;
}

export function validateEntitlement(value: unknown): Entitlement {
  const record = asRecord(value, 'Entitlement');
  assertOnlyFields(record, 'Entitlement', [
    'entitlementId',
    'paymentId',
    'orderId',
    'productId',
    'ownerUserId',
    'userBinding',
    'status',
    'issuedAt',
    'revokedAt',
    'revocationReason'
  ]);
  validateVersionedEntity(record, 'Entitlement');
  requireSha256(record, 'entitlementId');
  requireOrderId(record, 'paymentId');
  requireOrderId(record, 'orderId');
  validateOwner(record);
  requireProductId(record);
  const status = requireOneOf(record, 'status', ENTITLEMENT_STATUSES);
  requireTimestamp(record, 'issuedAt');
  optionalTimestamp(record, 'revokedAt');
  optionalString(record, 'revocationReason', 160);

  if (status === 'revoked') {
    requireTimestamp(record, 'revokedAt');
    requireString(record, 'revocationReason', { max: 160 });
  }

  if (
    status === 'active' &&
    (record.revokedAt !== undefined || record.revocationReason !== undefined)
  ) {
    fail('DATA_CONTRACT_STATE_TIMESTAMP_CONFLICT', 'Active entitlement cannot have revocation fields.');
  }

  return record as unknown as Entitlement;
}

export function validateReportGenerationJob(value: unknown): ReportGenerationJob {
  const record = asRecord(value, 'ReportGenerationJob');
  assertOnlyFields(record, 'ReportGenerationJob', [
    'jobId',
    'orderId',
    'entitlementId',
    'productId',
    'ownerUserId',
    'userBinding',
    'inputHash',
    'status',
    'attemptCount',
    'provider',
    'leaseId',
    'leaseExpiresAt',
    'startedAt',
    'completedAt',
    'failedAt',
    'cancelledAt',
    'errorCode'
  ]);
  validateVersionedEntity(record, 'ReportGenerationJob');
  const jobId = requireSha256(record, 'jobId');
  requireOrderId(record);
  const entitlementId = requireSha256(record, 'entitlementId');
  validateOwner(record);
  requireProductId(record);
  const inputHash = requireSha256(record, 'inputHash');

  if (
    jobId !== getReportGenerationJobId(entitlementId) ||
    record.idempotencyKey !==
      getReportGenerationIdempotencyKey(entitlementId, inputHash)
  ) {
    fail(
      'REPORT_GENERATION_IDENTITY_MISMATCH',
      'ReportGenerationJob identity does not match its entitlement and input.'
    );
  }
  const status = requireOneOf(record, 'status', REPORT_GENERATION_JOB_STATUSES);
  const attemptCount = requireNonNegativeInteger(record, 'attemptCount');
  optionalString(record, 'provider', 120);
  optionalString(record, 'leaseId', 256);
  optionalString(record, 'errorCode', 160);
  optionalTimestamp(record, 'leaseExpiresAt');
  optionalTimestamp(record, 'startedAt');
  optionalTimestamp(record, 'completedAt');
  optionalTimestamp(record, 'failedAt');
  optionalTimestamp(record, 'cancelledAt');

  if (status === 'generating') {
    if (attemptCount < 1) {
      fail('DATA_CONTRACT_INVALID_FIELD', 'A generating job must have at least one attempt.');
    }
    requireString(record, 'leaseId', { max: 256 });
    requireTimestamp(record, 'leaseExpiresAt');
    requireTimestamp(record, 'startedAt');
  } else if (status === 'completed') {
    if (attemptCount < 1) {
      fail('DATA_CONTRACT_INVALID_FIELD', 'A completed job must have at least one attempt.');
    }
    requireTimestamp(record, 'completedAt');
  } else if (status === 'failed') {
    if (attemptCount < 1) {
      fail('DATA_CONTRACT_INVALID_FIELD', 'A failed job must have at least one attempt.');
    }
    requireTimestamp(record, 'failedAt');
    requireString(record, 'errorCode', { max: 160 });
  } else if (status === 'cancelled') {
    requireTimestamp(record, 'cancelledAt');
  }

  const terminalFields = ['completedAt', 'failedAt', 'cancelledAt'] as const;
  terminalFields.forEach((field) => {
    const expectedField =
      status === 'completed' ? 'completedAt' :
      status === 'failed' ? 'failedAt' :
      status === 'cancelled' ? 'cancelledAt' : null;

    if (record[field] !== undefined && field !== expectedField) {
      fail(
        'DATA_CONTRACT_STATE_TIMESTAMP_CONFLICT',
        `${field} conflicts with ReportGenerationJob status ${status}.`
      );
    }
  });

  return record as unknown as ReportGenerationJob;
}

export function validateReportArchive(value: unknown): ReportArchive {
  const record = asRecord(value, 'ReportArchive');
  assertOnlyFields(record, 'ReportArchive', [
    'archiveId',
    'orderId',
    'entitlementId',
    'productId',
    'ownerUserId',
    'userBinding',
    'status',
    'reportData',
    'reportProvider',
    'reportVersion'
  ]);
  validateVersionedEntity(record, 'ReportArchive');
  requireString(record, 'archiveId', { max: 256 });
  requireOrderId(record);
  requireSha256(record, 'entitlementId');
  validateOwner(record);
  requireProductId(record);
  requireOneOf(record, 'status', REPORT_ARCHIVE_STATUSES);
  requireString(record, 'reportProvider', { max: 120 });
  const reportVersion = requirePositiveAmount(record, 'reportVersion');

  if (reportVersion < 1 || !record.reportData || typeof record.reportData !== 'object' || Array.isArray(record.reportData)) {
    fail('DATA_CONTRACT_INVALID_FIELD', 'ReportArchive reportVersion or reportData is invalid.');
  }

  return record as unknown as ReportArchive;
}

export function validateAdminAuditEvent(value: unknown): AdminAuditEvent {
  const record = asRecord(value, 'AdminAuditEvent');
  assertOnlyFields(record, 'AdminAuditEvent', [
    'eventId',
    'actorAdminId',
    'ownerUserId',
    'productId',
    'status',
    'action',
    'resourceType',
    'resourceIdHash',
    'requestId',
    'metadata'
  ]);
  validateVersionedEntity(record, 'AdminAuditEvent');
  requireString(record, 'eventId', { max: 200 });
  requireString(record, 'actorAdminId', { max: 128 });
  requireOneOf(record, 'status', ADMIN_AUDIT_EVENT_STATUSES);
  requireString(record, 'action', { max: 160 });
  requireString(record, 'resourceType', { max: 120 });
  requireString(record, 'requestId', { max: 200 });
  optionalString(record, 'resourceIdHash', 64);

  if (record.resourceIdHash !== undefined && !isSha256Hex(record.resourceIdHash)) {
    fail('DATA_CONTRACT_INVALID_HASH', 'resourceIdHash must be a lowercase SHA-256 value.');
  }

  if (record.ownerUserId !== null && typeof record.ownerUserId !== 'string') {
    fail('DATA_CONTRACT_INVALID_FIELD', 'ownerUserId must be a string or null.');
  }

  if (typeof record.ownerUserId === 'string') {
    requireString(record, 'ownerUserId', { max: 128 });
  }

  if (record.productId !== null && !isKnownProductId(record.productId)) {
    fail('PRODUCT_UNKNOWN', 'AdminAuditEvent productId is unknown.');
  }

  if (record.metadata !== undefined) {
    const metadata = asRecord(record.metadata, 'AdminAuditEvent.metadata');

    Object.values(metadata).forEach((metadataValue) => {
      if (
        typeof metadataValue !== 'string' &&
        typeof metadataValue !== 'number' &&
        typeof metadataValue !== 'boolean'
      ) {
        fail('DATA_CONTRACT_INVALID_FIELD', 'Audit metadata values must be scalar.');
      }
    });
  }

  if (record.updatedAt !== record.createdAt) {
    fail('ADMIN_AUDIT_EVENT_IMMUTABLE', 'AdminAuditEvent must be append-only.');
  }

  return record as unknown as AdminAuditEvent;
}

export function getAuthoritativeProductStatus(productId: ProductId): ProductStatus {
  return SERVER_PRODUCT_CATALOG[productId].status;
}
