import type { AdminAuditEvent } from './models.ts';
import {
  DataContractError,
  isIsoDateTime,
  isKnownProductId,
  isSha256Hex,
  validateAdminAuditEvent
} from './validation.ts';

function normalizeFieldName(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

export const SENSITIVE_FIELD_NAMES = Object.freeze([
  'name',
  'nickname',
  'customerName',
  'email',
  'birthDate',
  'dateOfBirth',
  'birthTime',
  'userQuestion',
  'question',
  'authToken',
  'accessToken',
  'adminAccessToken',
  'reportAccessToken',
  'orderClaim',
  'portOneApiSecret',
  'apiSecret',
  'password',
  'adminPassword',
  'adminCredential',
  'adminCredentialHash',
  'reportData',
  'formData',
  'requestBody',
  'responseBody',
  'providerResponse',
  'stack'
] as const);

const NORMALIZED_SENSITIVE_FIELDS = new Set(
  SENSITIVE_FIELD_NAMES.map(normalizeFieldName)
);

export const SERVER_SECRET_FIELD_NAMES = Object.freeze([
  'authToken',
  'accessToken',
  'adminAccessToken',
  'reportAccessToken',
  'orderClaim',
  'portOneApiSecret',
  'apiSecret',
  'password',
  'adminPassword',
  'adminCredential',
  'adminCredentialHash',
  'requestBody',
  'responseBody',
  'providerResponse',
  'stack'
] as const);

const NORMALIZED_SERVER_SECRET_FIELDS = new Set(
  SERVER_SECRET_FIELD_NAMES.map(normalizeFieldName)
);

export function assertNoServerSecretKeys(
  value: unknown,
  path = 'value'
): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertNoServerSecretKeys(entry, `${path}[${index}]`)
    );
    return;
  }
  if (!value || typeof value !== 'object') {
    return;
  }

  Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
    if (NORMALIZED_SERVER_SECRET_FIELDS.has(normalizeFieldName(key))) {
      throw new DataContractError(
        'SERVER_SECRET_FIELD_FORBIDDEN',
        `Server secret field is not allowed in ${path}.`
      );
    }
    assertNoServerSecretKeys(entry, `${path}.${key}`);
  });
}

export function isSensitiveFieldName(fieldName: string) {
  return NORMALIZED_SENSITIVE_FIELDS.has(normalizeFieldName(fieldName));
}

export function assertNoSensitiveKeys(value: unknown, path = 'value'): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoSensitiveKeys(entry, `${path}[${index}]`));
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
    if (isSensitiveFieldName(key)) {
      throw new DataContractError(
        'SENSITIVE_FIELD_FORBIDDEN',
        `Sensitive field is not allowed in ${path}.`
      );
    }

    assertNoSensitiveKeys(entry, `${path}.${key}`);
  });
}

const SAFE_AUDIT_METADATA_KEYS = new Set([
  'attemptCount',
  'durationMs',
  'httpStatus',
  'reasonCode',
  'resultCount',
  'schemaVersion',
  'source'
]);

const SAFE_OPAQUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const SAFE_ACTION_PATTERN = /^[a-z][a-z0-9._-]{1,119}$/;
const SAFE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,79}$/;
const SAFE_SOURCE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const SAFE_RESOURCE_TYPE_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{0,79}$/;

function assertPattern(value: unknown, pattern: RegExp, field: string) {
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new DataContractError(
      'UNSAFE_LOG_VALUE',
      `${field} must be an approved opaque identifier or stable code.`
    );
  }
}

function assertNonNegativeInteger(value: unknown, field: string) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new DataContractError(
      'UNSAFE_LOG_VALUE',
      `${field} must be a non-negative safe integer.`
    );
  }
}

function assertSafeAuditMetadataValue(key: string, value: unknown) {
  if (key === 'reasonCode') {
    assertPattern(value, SAFE_CODE_PATTERN, `AdminAuditEvent.metadata.${key}`);
    return;
  }
  if (key === 'source') {
    assertPattern(value, SAFE_SOURCE_PATTERN, `AdminAuditEvent.metadata.${key}`);
    return;
  }

  assertNonNegativeInteger(value, `AdminAuditEvent.metadata.${key}`);
  if (key === 'httpStatus' && ((value as number) < 100 || (value as number) > 599)) {
    throw new DataContractError(
      'UNSAFE_LOG_VALUE',
      'AdminAuditEvent.metadata.httpStatus must be a valid HTTP status.'
    );
  }
}

export function validateAdminAuditEventForPersistence(value: unknown): AdminAuditEvent {
  const event = validateAdminAuditEvent(value);
  const metadata = event.metadata ?? {};
  assertNoSensitiveKeys(event, 'AdminAuditEvent');
  assertNoSensitiveKeys(metadata, 'AdminAuditEvent.metadata');
  assertPattern(event.eventId, SAFE_OPAQUE_ID_PATTERN, 'AdminAuditEvent.eventId');
  assertPattern(event.actorAdminId, SAFE_OPAQUE_ID_PATTERN, 'AdminAuditEvent.actorAdminId');
  assertPattern(event.action, SAFE_ACTION_PATTERN, 'AdminAuditEvent.action');
  assertPattern(event.resourceType, SAFE_RESOURCE_TYPE_PATTERN, 'AdminAuditEvent.resourceType');
  assertPattern(event.requestId, SAFE_OPAQUE_ID_PATTERN, 'AdminAuditEvent.requestId');
  assertPattern(event.idempotencyKey, SAFE_OPAQUE_ID_PATTERN, 'AdminAuditEvent.idempotencyKey');

  if (event.ownerUserId !== null) {
    assertPattern(event.ownerUserId, SAFE_OPAQUE_ID_PATTERN, 'AdminAuditEvent.ownerUserId');
  }

  Object.entries(metadata).forEach(([key, metadataValue]) => {
    if (!SAFE_AUDIT_METADATA_KEYS.has(key)) {
      throw new DataContractError(
        'ADMIN_AUDIT_METADATA_FIELD_FORBIDDEN',
        'Admin audit metadata contains an unapproved field.'
      );
    }

    assertSafeAuditMetadataValue(key, metadataValue);
  });

  return event;
}

export type OperationalLogLevel = 'info' | 'warn' | 'error';

export type SafeOperationalLogInput = Readonly<{
  event: string;
  level: OperationalLogLevel;
  timestamp: string;
  code?: string;
  status?: number;
  requestId?: string;
  resourceType?: string;
  resourceIdHash?: string;
  productId?: string;
  attemptCount?: number;
  durationMs?: number;
  errorName?: string;
}>;

export type SafeOperationalLog = SafeOperationalLogInput & Readonly<{
  schemaVersion: 1;
}>;

const SAFE_OPERATIONAL_LOG_KEYS = new Set([
  'event',
  'level',
  'timestamp',
  'code',
  'status',
  'requestId',
  'resourceType',
  'resourceIdHash',
  'productId',
  'attemptCount',
  'durationMs',
  'errorName'
]);

export function createSafeOperationalLog(input: SafeOperationalLogInput): SafeOperationalLog {
  const raw = input as unknown as Record<string, unknown>;
  assertNoSensitiveKeys(raw, 'OperationalLog');

  Object.keys(raw).forEach((key) => {
    if (!SAFE_OPERATIONAL_LOG_KEYS.has(key)) {
      throw new DataContractError(
        'UNSAFE_LOG_FIELD',
        'Operational log contains an unapproved field.'
      );
    }
  });

  if (
    typeof input.event !== 'string' ||
    !/^[a-z0-9][a-z0-9._-]{1,119}$/.test(input.event) ||
    !['info', 'warn', 'error'].includes(input.level) ||
    !isIsoDateTime(input.timestamp)
  ) {
    throw new DataContractError(
      'UNSAFE_LOG_VALUE',
      'Operational log event, level, or timestamp is invalid.'
    );
  }

  if (input.resourceIdHash !== undefined && !isSha256Hex(input.resourceIdHash)) {
    throw new DataContractError(
      'UNSAFE_LOG_VALUE',
      'Operational resourceIdHash must be a lowercase SHA-256 value.'
    );
  }

  if (input.code !== undefined) {
    assertPattern(input.code, SAFE_CODE_PATTERN, 'OperationalLog.code');
  }
  if (input.requestId !== undefined) {
    assertPattern(input.requestId, SAFE_OPAQUE_ID_PATTERN, 'OperationalLog.requestId');
  }
  if (input.resourceType !== undefined) {
    assertPattern(
      input.resourceType,
      SAFE_RESOURCE_TYPE_PATTERN,
      'OperationalLog.resourceType'
    );
  }
  if (input.productId !== undefined && !isKnownProductId(input.productId)) {
    throw new DataContractError(
      'UNSAFE_LOG_VALUE',
      'OperationalLog.productId must be a known product.'
    );
  }
  if (input.errorName !== undefined) {
    assertPattern(input.errorName, /^[A-Za-z][A-Za-z0-9]{0,79}$/, 'OperationalLog.errorName');
  }
  if (input.status !== undefined) {
    assertNonNegativeInteger(input.status, 'OperationalLog.status');
    if (input.status < 100 || input.status > 599) {
      throw new DataContractError('UNSAFE_LOG_VALUE', 'OperationalLog.status is invalid.');
    }
  }
  if (input.attemptCount !== undefined) {
    assertNonNegativeInteger(input.attemptCount, 'OperationalLog.attemptCount');
  }
  if (input.durationMs !== undefined) {
    assertNonNegativeInteger(input.durationMs, 'OperationalLog.durationMs');
  }

  return Object.freeze({ ...input, schemaVersion: 1 });
}

export function getSafeErrorDiagnostics(error: unknown) {
  if (!error || typeof error !== 'object') {
    return { errorName: 'UnknownError' } as const;
  }

  const candidate = error as { name?: unknown; code?: unknown; status?: unknown };
  const errorName =
    typeof candidate.name === 'string' && /^[A-Za-z][A-Za-z0-9]{0,79}$/.test(candidate.name)
      ? candidate.name
      : 'Error';
  const code =
    typeof candidate.code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(candidate.code)
      ? candidate.code
      : undefined;
  const status =
    typeof candidate.status === 'number' &&
    Number.isSafeInteger(candidate.status) &&
    candidate.status >= 100 &&
    candidate.status <= 599
      ? candidate.status
      : undefined;

  return Object.freeze({
    errorName,
    ...(code ? { code } : {}),
    ...(status ? { status } : {})
  });
}

export type SafeLogWriter = Pick<Console, 'info' | 'warn' | 'error'>;

export function writeSafeOperationalLog(
  writer: SafeLogWriter,
  input: SafeOperationalLogInput
) {
  const entry = createSafeOperationalLog(input);
  writer[input.level](entry);
  return entry;
}
