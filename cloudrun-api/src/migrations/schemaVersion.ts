import { DATA_SCHEMA_VERSION } from '../contracts/models.ts';

export const LEGACY_SCHEMA_VERSION = 0 as const;
export const CURRENT_SCHEMA_VERSION = DATA_SCHEMA_VERSION;

export type SupportedStoredSchemaVersion =
  | typeof LEGACY_SCHEMA_VERSION
  | typeof CURRENT_SCHEMA_VERSION;

export class UnsupportedSchemaVersionError extends Error {
  readonly code = 'UNSUPPORTED_SCHEMA_VERSION';

  constructor(
    readonly model: string,
    readonly receivedVersion: unknown
  ) {
    super(
      `${model} schemaVersion must be ${LEGACY_SCHEMA_VERSION} or ${CURRENT_SCHEMA_VERSION}.`
    );
    this.name = 'UnsupportedSchemaVersionError';
  }
}

function unwrapFirestoreInteger(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const integerValue = (value as { integerValue?: unknown }).integerValue;

  if (typeof integerValue === 'string' && /^\d+$/.test(integerValue)) {
    return Number(integerValue);
  }

  return value;
}

export function readStoredSchemaVersion(
  source: unknown,
  model = 'document'
): SupportedStoredSchemaVersion {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new UnsupportedSchemaVersionError(model, undefined);
  }

  const record = source as Record<string, unknown>;
  const rawVersion = unwrapFirestoreInteger(record.schemaVersion);

  if (rawVersion === undefined || rawVersion === null || rawVersion === '') {
    return LEGACY_SCHEMA_VERSION;
  }

  if (
    rawVersion === LEGACY_SCHEMA_VERSION ||
    rawVersion === CURRENT_SCHEMA_VERSION
  ) {
    return rawVersion;
  }

  throw new UnsupportedSchemaVersionError(model, rawVersion);
}

export function assertLegacyProjectionSource(
  source: unknown,
  model: string
): typeof LEGACY_SCHEMA_VERSION {
  const sourceSchemaVersion = readStoredSchemaVersion(source, model);

  if (sourceSchemaVersion !== LEGACY_SCHEMA_VERSION) {
    throw new UnsupportedSchemaVersionError(model, sourceSchemaVersion);
  }

  return sourceSchemaVersion;
}

export type ReadOnlySchemaProjection<T> = Readonly<{
  sourceSchemaVersion: SupportedStoredSchemaVersion;
  targetSchemaVersion: typeof CURRENT_SCHEMA_VERSION;
  requiresWrite: false;
  value: T;
}>;

export function createReadOnlyProjection<T>(
  sourceSchemaVersion: SupportedStoredSchemaVersion,
  value: T
): ReadOnlySchemaProjection<T> {
  return Object.freeze({
    sourceSchemaVersion,
    targetSchemaVersion: CURRENT_SCHEMA_VERSION,
    requiresWrite: false as const,
    value
  });
}
