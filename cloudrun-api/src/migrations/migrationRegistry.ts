import type { DataModelName } from '../contracts/models.ts';
import {
  DEFAULT_FIRESTORE_COLLECTIONS,
  type FirestoreCollectionNames
} from '../repositories/collections.ts';
import {
  CURRENT_SCHEMA_VERSION,
  LEGACY_SCHEMA_VERSION
} from './schemaVersion.ts';

export type MigrationStrategy = 'new-documents-only' | 'read-adapter';

export type MigrationDescriptor = Readonly<{
  model: DataModelName;
  sourceSchemaVersion: typeof LEGACY_SCHEMA_VERSION;
  targetSchemaVersion: typeof CURRENT_SCHEMA_VERSION;
  strategy: MigrationStrategy;
  sourceCollections: readonly string[];
  targetCollection: string;
  adapter: string | null;
  performsWrites: false;
  performsDeletes: false;
  notes: string;
}>;

const descriptor = (
  value: Omit<
    MigrationDescriptor,
    | 'sourceSchemaVersion'
    | 'targetSchemaVersion'
    | 'performsWrites'
    | 'performsDeletes'
  >
): MigrationDescriptor =>
  Object.freeze({
    ...value,
    sourceCollections: Object.freeze([...value.sourceCollections]),
    sourceSchemaVersion: LEGACY_SCHEMA_VERSION,
    targetSchemaVersion: CURRENT_SCHEMA_VERSION,
    performsWrites: false,
    performsDeletes: false
  });

/**
 * This registry is documentation executable as data. It deliberately contains
 * no migration runner: production backfills, dual writes, deletes, and TTL
 * changes require a separately approved operation.
 */
export function createDataMigrationRegistry(
  collections: FirestoreCollectionNames = DEFAULT_FIRESTORE_COLLECTIONS
) {
  return Object.freeze([
  descriptor({
    model: 'UserAccount',
    strategy: 'new-documents-only',
    sourceCollections: [],
    targetCollection: collections.userAccounts,
    adapter: null,
    notes: 'No legacy Firestore user document is claimed by this contract.'
  }),
  descriptor({
    model: 'ProductCatalogSnapshot',
    strategy: 'new-documents-only',
    sourceCollections: [],
    targetCollection: collections.productCatalogSnapshots,
    adapter: null,
    notes: 'Existing code catalog values remain authoritative until a snapshot is created.'
  }),
  descriptor({
    model: 'Order',
    strategy: 'new-documents-only',
    sourceCollections: [],
    targetCollection: collections.orders,
    adapter: null,
    notes: 'Legacy signed order claims are not rewritten as stored Order documents.'
  }),
  descriptor({
    model: 'Payment',
    strategy: 'read-adapter',
    sourceCollections: [
      collections.portOnePaymentConfirmations
    ],
    targetCollection: collections.payments,
    adapter: 'projectLegacyPaymentLedger',
    notes: 'Confirmed PortOne ledger fields project to a paid Payment without writing.'
  }),
  descriptor({
    model: 'Entitlement',
    strategy: 'read-adapter',
    sourceCollections: [
      collections.portOnePaymentConfirmations
    ],
    targetCollection: collections.entitlements,
    adapter: 'projectLegacyPaymentLedger',
    notes: 'The co-located entitlement projects independently without moving data.'
  }),
  descriptor({
    model: 'ReportGenerationJob',
    strategy: 'read-adapter',
    sourceCollections: [
      collections.portOnePaymentConfirmations
    ],
    targetCollection: collections.reportGenerationJobs,
    adapter: 'projectLegacyPaymentLedger',
    notes: 'A job is projected only when legacy report-generation state exists.'
  }),
  descriptor({
    model: 'ReportArchive',
    strategy: 'read-adapter',
    sourceCollections: [collections.reportArchives],
    targetCollection: collections.reportArchives,
    adapter: 'projectLegacyReportArchive',
    notes: 'Legacy entryJson and owner-scoped document identity remain unchanged.'
  }),
  descriptor({
    model: 'AdminAuditEvent',
    strategy: 'new-documents-only',
    sourceCollections: [],
    targetCollection: collections.adminAuditEvents,
    adapter: null,
    notes: 'No historical administrator activity is fabricated or backfilled.'
  })
] as const satisfies readonly MigrationDescriptor[]);
}

export const DATA_MIGRATION_REGISTRY = createDataMigrationRegistry();

export function getMigrationDescriptor(
  model: DataModelName,
  registry: readonly MigrationDescriptor[] = DATA_MIGRATION_REGISTRY
) {
  return registry.find((entry) => entry.model === model);
}
