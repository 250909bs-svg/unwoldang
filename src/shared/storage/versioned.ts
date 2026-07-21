import type { StorageCodec, StorageKeyContract } from './contracts';

const VERSION_FIELD = '__unwoldangStorageVersion';
const PAYLOAD_FIELD = 'payload';
const LEGACY_RAW_VERSION = 1;

type JsonMigration<T> = (legacyValue: unknown) => T;

type VersionedJsonOptions<T> = {
  decode: (value: unknown) => T;
  migrations?: Readonly<Record<number, JsonMigration<T>>>;
};

type VersionEnvelope = {
  [VERSION_FIELD]: number;
  [PAYLOAD_FIELD]: unknown;
};

const isVersionEnvelope = (value: unknown): value is VersionEnvelope => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return Number.isSafeInteger(candidate[VERSION_FIELD]) && PAYLOAD_FIELD in candidate;
};

const createVersionEnvelope = (version: number, payload: unknown): VersionEnvelope => ({
  [VERSION_FIELD]: version,
  [PAYLOAD_FIELD]: payload
});

/**
 * Version 1 remains the legacy raw JSON shape. Versions 2+ use an envelope so
 * readers can reject unknown versions or run an explicit per-version migration.
 */
export function versionedJsonStorageCodec<T>(
  contract: StorageKeyContract,
  options: VersionedJsonOptions<T>
): StorageCodec<T> {
  return {
    serialize: (value) => JSON.stringify(
      contract.version === LEGACY_RAW_VERSION
        ? value
        : createVersionEnvelope(contract.version, value)
    ),
    deserialize: (raw) => {
      const parsed = JSON.parse(raw) as unknown;

      if (isVersionEnvelope(parsed)) {
        const storedVersion = parsed[VERSION_FIELD];

        if (storedVersion === contract.version) {
          return options.decode(parsed[PAYLOAD_FIELD]);
        }

        const migrate = options.migrations?.[storedVersion];
        if (!migrate) {
          throw new Error(`Unsupported storage version: ${storedVersion}`);
        }

        return migrate(parsed[PAYLOAD_FIELD]);
      }

      if (contract.version === LEGACY_RAW_VERSION) {
        return options.decode(parsed);
      }

      const migrateLegacy = options.migrations?.[LEGACY_RAW_VERSION];
      if (!migrateLegacy) {
        throw new Error(`Missing migration from storage version ${LEGACY_RAW_VERSION}`);
      }

      return migrateLegacy(parsed);
    }
  };
}

type StringMigration = (legacyValue: string) => string;

/**
 * Version 1 returns every raw string byte-for-byte. Versions 2+ use a JSON
 * envelope; customer-key v1 values always remain distinguishable as raw data.
 */
export function versionedStringStorageCodec(
  contract: StorageKeyContract,
  migrations: Readonly<Record<number, StringMigration>> = {}
): StorageCodec<string> {
  return {
    serialize: (value) => contract.version === LEGACY_RAW_VERSION
      ? value
      : JSON.stringify(createVersionEnvelope(contract.version, value)),
    deserialize: (raw) => {
      if (contract.version === LEGACY_RAW_VERSION) {
        return raw;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw) as unknown;
      } catch {
        parsed = null;
      }

      if (isVersionEnvelope(parsed)) {
        const storedVersion = parsed[VERSION_FIELD];
        const payload = parsed[PAYLOAD_FIELD];

        if (typeof payload !== 'string') {
          throw new Error('Invalid versioned string payload.');
        }

        if (storedVersion === contract.version) {
          return payload;
        }

        const migrate = migrations[storedVersion];
        if (!migrate) {
          throw new Error(`Unsupported storage version: ${storedVersion}`);
        }

        return migrate(payload);
      }

      const migrateLegacy = migrations[LEGACY_RAW_VERSION];
      if (!migrateLegacy) {
        throw new Error(`Missing migration from storage version ${LEGACY_RAW_VERSION}`);
      }

      return migrateLegacy(raw);
    }
  };
}
