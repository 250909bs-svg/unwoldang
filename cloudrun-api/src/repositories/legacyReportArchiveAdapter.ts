import { createHash } from 'node:crypto';
import type {
  LegacyReportArchiveProjection,
  Sha256Hex
} from '../contracts/models.ts';
import { DATA_SCHEMA_VERSION } from '../contracts/models.ts';
import {
  isProductAvailableForExistingAccess,
  SERVER_PRODUCT_CATALOG,
  type ProductId,
  type ProductStatus
} from '../contracts/products.ts';
import {
  assertLegacyProjectionSource,
  LEGACY_SCHEMA_VERSION
} from '../migrations/schemaVersion.ts';
import { getLegacyPaymentLedgerDocumentId } from './legacyPaymentLedgerAdapter.ts';

export type LegacyReportArchiveSource = Readonly<Record<string, unknown>>;

export type LegacyReportArchiveCompatibilityProjection = Readonly<{
  sourceSchemaVersion: typeof LEGACY_SCHEMA_VERSION;
  targetSchemaVersion: typeof DATA_SCHEMA_VERSION;
  requiresWrite: false;
  documentId: string;
  entryJson: string;
  archive: LegacyReportArchiveProjection;
  derivedEntitlementId: Sha256Hex | null;
  productStatus: ProductStatus;
}>;

export class LegacyReportArchiveAdapterError extends Error {
  readonly code = 'LEGACY_REPORT_ARCHIVE_INVALID';

  constructor(message: string) {
    super(message);
    this.name = 'LegacyReportArchiveAdapterError';
  }
}

export class LegacyReportArchiveOwnerScopeError extends Error {
  readonly code = 'REPORT_ARCHIVE_NOT_FOUND';
  readonly status = 404;

  constructor() {
    super('Archive was not found for the authenticated owner.');
    this.name = 'LegacyReportArchiveOwnerScopeError';
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

function fieldsOf(source: LegacyReportArchiveSource) {
  return asRecord(source.fields) || source;
}

function readField(source: LegacyReportArchiveSource, key: string) {
  return unwrapFirestoreValue(fieldsOf(source)[key]);
}

function optionalString(source: LegacyReportArchiveSource, key: string) {
  const value = readField(source, key);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function requiredString(source: LegacyReportArchiveSource, key: string) {
  const value = optionalString(source, key);

  if (!value) {
    throw new LegacyReportArchiveAdapterError(`${key} is required.`);
  }

  return value;
}

function requiredRawString(source: LegacyReportArchiveSource, key: string) {
  const value = readField(source, key);

  if (typeof value !== 'string' || !value.trim()) {
    throw new LegacyReportArchiveAdapterError(`${key} is required.`);
  }

  return value;
}

function documentIdFromSource(source: LegacyReportArchiveSource) {
  if (typeof source.documentId === 'string' && source.documentId.trim()) {
    return source.documentId.trim();
  }

  if (typeof source.name === 'string' && source.name.trim()) {
    return source.name.split('/').pop() || '';
  }

  return '';
}

function assertIsoDateTime(value: string, field: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new LegacyReportArchiveAdapterError(`${field} must be an ISO timestamp.`);
  }

  return new Date(timestamp).toISOString();
}

function optionalEntryString(entry: Record<string, unknown>, key: string) {
  const value = entry[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function reconcileString(
  storedValue: string | undefined,
  entryValue: string | undefined,
  field: string,
  required: true
): string;
function reconcileString(
  storedValue: string | undefined,
  entryValue: string | undefined,
  field: string,
  required: false
): string | null;
function reconcileString(
  storedValue: string | undefined,
  entryValue: string | undefined,
  field: string,
  required: boolean
) {
  if (storedValue && entryValue && storedValue !== entryValue) {
    throw new LegacyReportArchiveAdapterError(
      `${field} does not match entryJson.`
    );
  }

  const value = storedValue || entryValue;

  if (!value && required) {
    throw new LegacyReportArchiveAdapterError(`${field} is required.`);
  }

  return value || null;
}

function readProduct(productId: string) {
  const product = SERVER_PRODUCT_CATALOG[productId as ProductId];

  if (!product || !isProductAvailableForExistingAccess(product.status)) {
    throw new LegacyReportArchiveAdapterError(
      'productId is not eligible for existing report recovery.'
    );
  }

  return {
    productId: productId as ProductId,
    status: product.status
  };
}

function readReportVersion(entry: Record<string, unknown>) {
  const value = entry.reportVersion;

  if (value === undefined) {
    return 1;
  }

  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new LegacyReportArchiveAdapterError(
      'reportVersion must be a positive integer.'
    );
  }

  return value;
}

export function getLegacyReportArchiveDocumentId(
  ownerUserId: string,
  archiveId: string
) {
  if (!ownerUserId.trim() || !archiveId.trim()) {
    throw new LegacyReportArchiveAdapterError(
      'ownerUserId and archiveId are required.'
    );
  }

  return createHash('sha256')
    .update(`${ownerUserId.trim()}:${archiveId.trim()}`)
    .digest('hex');
}

export function projectLegacyReportArchive(
  source: LegacyReportArchiveSource,
  options: Readonly<{ documentId?: string }> = {}
): LegacyReportArchiveCompatibilityProjection {
  const schemaSource = asRecord(source.fields) || source;
  const sourceSchemaVersion = assertLegacyProjectionSource(
    schemaSource,
    'reportArchives'
  );
  const ownerUserId = requiredString(source, 'userId');
  const entryJson = requiredRawString(source, 'entryJson');
  let parsedEntry: unknown;

  try {
    parsedEntry = JSON.parse(entryJson);
  } catch {
    throw new LegacyReportArchiveAdapterError('entryJson must contain valid JSON.');
  }

  const entry = asRecord(parsedEntry);

  if (!entry) {
    throw new LegacyReportArchiveAdapterError(
      'entryJson must contain an object.'
    );
  }

  const archiveId = reconcileString(
    optionalString(source, 'archiveId'),
    optionalEntryString(entry, 'id'),
    'archiveId',
    true
  );
  const expectedDocumentId = getLegacyReportArchiveDocumentId(
    ownerUserId,
    archiveId
  );
  const suppliedDocumentId = options.documentId?.trim() || documentIdFromSource(source);

  if (suppliedDocumentId && suppliedDocumentId !== expectedDocumentId) {
    throw new LegacyReportArchiveAdapterError(
      'Report archive document ID does not match its owner and archive ID.'
    );
  }

  const reconciledProductId = reconcileString(
    optionalString(source, 'productId'),
    optionalEntryString(entry, 'productId'),
    'productId',
    true
  );
  const { productId, status: productStatus } = readProduct(reconciledProductId);
  const orderId = reconcileString(
    optionalString(source, 'orderId'),
    optionalEntryString(entry, 'orderId'),
    'orderId',
    false
  );
  const reportData = asRecord(entry.reportData);

  if (!reportData) {
    throw new LegacyReportArchiveAdapterError(
      'entryJson.reportData must contain an object.'
    );
  }

  const storedCreatedAt = optionalString(source, 'createdAt');
  const entryCreatedAt = optionalEntryString(entry, 'createdAt');

  if (storedCreatedAt && entryCreatedAt && storedCreatedAt !== entryCreatedAt) {
    throw new LegacyReportArchiveAdapterError(
      'createdAt does not match entryJson.'
    );
  }

  const createdAt = assertIsoDateTime(
    storedCreatedAt || entryCreatedAt || '',
    'createdAt'
  );
  const updateTime =
    typeof source.updateTime === 'string' && source.updateTime.trim()
      ? source.updateTime.trim()
      : createdAt;
  const reportProvider =
    optionalEntryString(entry, 'reportProvider') || 'legacy-archive';
  const archive: LegacyReportArchiveProjection = Object.freeze({
    schemaVersion: DATA_SCHEMA_VERSION,
    sourceSchemaVersion: LEGACY_SCHEMA_VERSION,
    archiveId,
    orderId,
    entitlementId: null,
    productId,
    ownerUserId,
    userBinding: null,
    status: 'available',
    reportData,
    reportProvider,
    reportVersion: readReportVersion(entry),
    idempotencyKey: expectedDocumentId,
    createdAt,
    updatedAt: assertIsoDateTime(updateTime, 'updatedAt')
  });

  return Object.freeze({
    sourceSchemaVersion,
    targetSchemaVersion: DATA_SCHEMA_VERSION,
    requiresWrite: false as const,
    documentId: expectedDocumentId,
    entryJson,
    archive,
    derivedEntitlementId: orderId
      ? getLegacyPaymentLedgerDocumentId(orderId)
      : null,
    productStatus
  });
}

export function assertLegacyReportArchiveOwnerScope(
  projection: LegacyReportArchiveCompatibilityProjection,
  authenticatedOwnerUserId: string
) {
  const normalizedOwner = authenticatedOwnerUserId.trim();

  if (
    !normalizedOwner ||
    projection.archive.ownerUserId !== normalizedOwner ||
    projection.documentId !==
      getLegacyReportArchiveDocumentId(
        normalizedOwner,
        projection.archive.archiveId
      )
  ) {
    throw new LegacyReportArchiveOwnerScopeError();
  }

  return projection;
}
