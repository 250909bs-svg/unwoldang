import { describe, expect, it } from 'vitest';
import {
  DATA_MIGRATION_REGISTRY,
  LEGACY_SCHEMA_VERSION,
  createDataMigrationRegistry,
  readStoredSchemaVersion,
  UnsupportedSchemaVersionError
} from '../../../cloudrun-api/src/migrations/index.ts';
import {
  DEFAULT_FIRESTORE_COLLECTIONS,
  resolveFirestoreCollections
} from '../../../cloudrun-api/src/repositories/collections.ts';
import {
  getLegacyPaymentLedgerDocumentId,
  getLegacyReportGenerationJobId,
  LegacyPaymentLedgerAdapterError,
  projectLegacyPaymentLedger
} from '../../../cloudrun-api/src/repositories/legacyPaymentLedgerAdapter.ts';
import {
  assertLegacyReportArchiveOwnerScope,
  getLegacyReportArchiveDocumentId,
  LegacyReportArchiveAdapterError,
  LegacyReportArchiveOwnerScopeError,
  projectLegacyReportArchive
} from '../../../cloudrun-api/src/repositories/legacyReportArchiveAdapter.ts';

const OWNER_USER_ID = 'kakao-fixture-owner';
const USER_BINDING = 'fixture-server-user-binding';
const ORDER_ID = 'UW-FIRESTORE-COMPAT-0001';
const PAYMENT_DOCUMENT_ID = getLegacyPaymentLedgerDocumentId(ORDER_ID);
const CONFIRMED_AT = '2026-07-20T01:02:03.000Z';

function legacyPaymentLedger(overrides: Record<string, unknown> = {}) {
  return {
    documentId: PAYMENT_DOCUMENT_ID,
    paymentId: ORDER_ID,
    orderId: ORDER_ID,
    productId: 'general-signature',
    amount: 79_000,
    currency: 'KRW',
    storeId: 'store-fixture',
    transactionId: 'transaction-fixture',
    confirmedAt: CONFIRMED_AT,
    userId: OWNER_USER_ID,
    userBinding: USER_BINDING,
    entitlementId: PAYMENT_DOCUMENT_ID,
    entitlementStatus: 'active',
    entitlementCreatedAt: CONFIRMED_AT,
    createTime: CONFIRMED_AT,
    updateTime: '2026-07-20T01:02:04.000Z',
    ...overrides
  };
}

function archiveEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'archive-fixture-0001',
    orderId: ORDER_ID,
    productId: 'life-flow',
    customerName: 'fixture name that remains only in entryJson',
    title: 'Fixture archived report',
    subtitle: '',
    createdAt: '2026-07-20T02:03:04.000Z',
    reportData: {
      title: 'historical report',
      sections: []
    },
    reportProvider: 'gemini',
    ...overrides
  };
}

describe('Firestore collection and schema-version compatibility contracts', () => {
  it('keeps exact legacy defaults while allowing the deployed environment overrides', () => {
    expect(DEFAULT_FIRESTORE_COLLECTIONS).toMatchObject({
      portOnePaymentConfirmations: 'portonePaymentConfirmations',
      reportArchives: 'reportArchives'
    });
    expect(DEFAULT_FIRESTORE_COLLECTIONS.userAccounts).toBe('users');

    const collections = resolveFirestoreCollections({
      PORTONE_PAYMENT_LEDGER_COLLECTION: 'existingPaymentLedgerOverride',
      FIRESTORE_ARCHIVE_COLLECTION: 'existingArchiveOverride'
    });

    expect(collections.portOnePaymentConfirmations).toBe(
      'existingPaymentLedgerOverride'
    );
    expect(collections.reportArchives).toBe('existingArchiveOverride');
    expect(collections.orders).toBe('orders');
    expect(Object.isFrozen(collections)).toBe(true);
  });

  it('builds migration descriptors from the resolved deployment collection names', () => {
    const collections = resolveFirestoreCollections({
      PORTONE_PAYMENT_LEDGER_COLLECTION: 'tenantPaymentLedger',
      FIRESTORE_ARCHIVE_COLLECTION: 'tenantReportArchives',
      FIRESTORE_PAYMENTS_COLLECTION: 'canonicalPayments',
      FIRESTORE_ORDERS_COLLECTION: 'canonicalOrders'
    });
    const registry = createDataMigrationRegistry(collections);

    expect(registry.find((entry) => entry.model === 'Payment')).toMatchObject({
      sourceCollections: ['tenantPaymentLedger'],
      targetCollection: 'canonicalPayments'
    });
    expect(registry.find((entry) => entry.model === 'Order')).toMatchObject({
      targetCollection: 'canonicalOrders'
    });
    expect(registry.find((entry) => entry.model === 'ReportArchive')).toMatchObject({
      sourceCollections: ['tenantReportArchives'],
      targetCollection: 'tenantReportArchives'
    });
  });

  it('treats a missing schemaVersion as legacy zero and rejects unknown versions', () => {
    expect(readStoredSchemaVersion({})).toBe(LEGACY_SCHEMA_VERSION);
    expect(
      readStoredSchemaVersion({ schemaVersion: { integerValue: '0' } })
    ).toBe(LEGACY_SCHEMA_VERSION);
    expect(readStoredSchemaVersion({ schemaVersion: 1 })).toBe(1);
    expect(() => readStoredSchemaVersion({ schemaVersion: 2 }, 'Payment')).toThrow(
      UnsupportedSchemaVersionError
    );
  });

  it('registers all eight models as read-only migration policy data', () => {
    expect(DATA_MIGRATION_REGISTRY.map((entry) => entry.model)).toEqual([
      'UserAccount',
      'ProductCatalogSnapshot',
      'Order',
      'Payment',
      'Entitlement',
      'ReportGenerationJob',
      'ReportArchive',
      'AdminAuditEvent'
    ]);
    expect(
      DATA_MIGRATION_REGISTRY.every(
        (entry) => !entry.performsWrites && !entry.performsDeletes
      )
    ).toBe(true);
    expect(
      DATA_MIGRATION_REGISTRY.find((entry) => entry.model === 'Payment')
    ).toMatchObject({
      strategy: 'read-adapter',
      sourceCollections: ['portonePaymentConfirmations'],
      adapter: 'projectLegacyPaymentLedger'
    });
  });
});

describe('legacy PortOne payment ledger projection', () => {
  it('projects a schema-less document into paid Payment and active Entitlement without writing', () => {
    const source = legacyPaymentLedger();
    const before = JSON.stringify(source);
    const projection = projectLegacyPaymentLedger(source);

    expect(JSON.stringify(source)).toBe(before);
    expect(projection).toMatchObject({
      sourceSchemaVersion: 0,
      targetSchemaVersion: 1,
      requiresWrite: false,
      documentId: PAYMENT_DOCUMENT_ID,
      payment: {
        schemaVersion: 1,
        paymentId: ORDER_ID,
        orderId: ORDER_ID,
        ownerUserId: OWNER_USER_ID,
        productId: 'general-signature',
        provider: 'portone',
        status: 'paid',
        amount: 79_000,
        currency: 'KRW'
      },
      entitlement: {
        schemaVersion: 1,
        entitlementId: PAYMENT_DOCUMENT_ID,
        paymentId: ORDER_ID,
        orderId: ORDER_ID,
        ownerUserId: OWNER_USER_ID,
        status: 'active'
      },
      reportGenerationJob: null
    });
    expect(Object.isFrozen(projection)).toBe(true);
  });

  it('recovers an archived-product entitlement and co-located completed job', () => {
    const inputHash = 'a'.repeat(64);
    const source = legacyPaymentLedger({
      productId: 'life-flow',
      amount: 59_000,
      reportInputHash: inputHash,
      reportGenerationStatus: 'completed',
      reportGenerationStartedAt: '2026-07-20T01:03:00.000Z',
      reportGenerationAttempt: 2,
      reportGenerationCompletedAt: '2026-07-20T01:04:00.000Z',
      reportJson: '{"provider":"gemini"}',
      reportJsonHash: 'b'.repeat(64)
    });
    const projection = projectLegacyPaymentLedger(source);

    expect(projection.entitlement.productId).toBe('life-flow');
    expect(projection.reportGenerationJob).toMatchObject({
      schemaVersion: 1,
      jobId: getLegacyReportGenerationJobId(PAYMENT_DOCUMENT_ID),
      entitlementId: PAYMENT_DOCUMENT_ID,
      productId: 'life-flow',
      inputHash,
      status: 'completed',
      attemptCount: 2,
      completedAt: '2026-07-20T01:04:00.000Z'
    });
  });

  it('normalizes Firestore timestamps and never promotes a raw failure string', () => {
    const rawFailure = 'private@example.com reportAccessToken=secret-token';
    const projection = projectLegacyPaymentLedger(
      legacyPaymentLedger({
        confirmedAt: '2026-07-20T01:02:03.123456Z',
        reportInputHash: 'c'.repeat(64),
        reportGenerationStatus: 'failed',
        reportGenerationAttempt: 1,
        reportGenerationFailedAt: '2026-07-20T01:04:05.987654Z',
        reportGenerationFailure: rawFailure
      })
    );

    expect(projection.payment.confirmedAt).toBe('2026-07-20T01:02:03.123Z');
    expect(projection.reportGenerationJob?.failedAt).toBe('2026-07-20T01:04:05.987Z');
    expect(projection.reportGenerationJob?.errorCode).toBe('LEGACY_REPORT_GENERATION_FAILED');
    expect(JSON.stringify(projection)).not.toContain(rawFailure);
  });

  it('fails closed when a document ID, entitlement ID, or product is incompatible', () => {
    expect(() =>
      projectLegacyPaymentLedger(legacyPaymentLedger(), {
        documentId: '0'.repeat(64)
      })
    ).toThrow(LegacyPaymentLedgerAdapterError);

    expect(() =>
      projectLegacyPaymentLedger(
        legacyPaymentLedger({ entitlementId: 'f'.repeat(64) })
      )
    ).toThrow('Stored entitlementId does not match');

    expect(() =>
      projectLegacyPaymentLedger(
        legacyPaymentLedger({ productId: 'unknown-product' })
      )
    ).toThrow('not eligible');
  });
});

describe('legacy report archive projection', () => {
  it('preserves entryJson and archived-product replay while deriving the old entitlement reference', () => {
    const entry = archiveEntry();
    const entryJson = JSON.stringify(entry);
    const archiveId = String(entry.id);
    const documentId = getLegacyReportArchiveDocumentId(
      OWNER_USER_ID,
      archiveId
    );
    const source = {
      documentId,
      userId: OWNER_USER_ID,
      archiveId,
      orderId: ORDER_ID,
      productId: 'life-flow',
      createdAt: entry.createdAt,
      entryJson,
      updateTime: '2026-07-20T02:03:05.000Z'
    };
    const projection = projectLegacyReportArchive(source);

    expect(projection.entryJson).toBe(entryJson);
    expect(projection.productStatus).toBe('archived');
    expect(projection.derivedEntitlementId).toBe(PAYMENT_DOCUMENT_ID);
    expect(projection.archive).toMatchObject({
      schemaVersion: 1,
      sourceSchemaVersion: 0,
      archiveId,
      orderId: ORDER_ID,
      entitlementId: null,
      ownerUserId: OWNER_USER_ID,
      userBinding: null,
      productId: 'life-flow',
      status: 'available',
      reportProvider: 'gemini',
      reportVersion: 1,
      reportData: entry.reportData
    });
    expect(
      assertLegacyReportArchiveOwnerScope(projection, OWNER_USER_ID)
    ).toBe(projection);
  });

  it('keeps an archive readable when legacy order and entitlement references are absent', () => {
    const entry = archiveEntry({
      id: 'archive-without-order',
      orderId: undefined,
      productId: 'general-signature'
    });
    const entryJson = JSON.stringify(entry);
    const source = {
      userId: OWNER_USER_ID,
      archiveId: entry.id,
      productId: entry.productId,
      createdAt: entry.createdAt,
      entryJson
    };

    const projection = projectLegacyReportArchive(source);

    expect(projection.archive.orderId).toBeNull();
    expect(projection.archive.entitlementId).toBeNull();
    expect(projection.derivedEntitlementId).toBeNull();
  });

  it('masks cross-owner access and rejects identity tampering', () => {
    const entry = archiveEntry();
    const source = {
      userId: OWNER_USER_ID,
      archiveId: entry.id,
      orderId: entry.orderId,
      productId: entry.productId,
      createdAt: entry.createdAt,
      entryJson: JSON.stringify(entry)
    };
    const projection = projectLegacyReportArchive(source);
    let ownerError: unknown;

    try {
      assertLegacyReportArchiveOwnerScope(projection, 'different-owner');
    } catch (error) {
      ownerError = error;
    }

    expect(ownerError).toBeInstanceOf(LegacyReportArchiveOwnerScopeError);
    expect(ownerError).toMatchObject({
      status: 404,
      code: 'REPORT_ARCHIVE_NOT_FOUND'
    });
    expect(String((ownerError as Error).message)).not.toContain(OWNER_USER_ID);

    expect(() =>
      projectLegacyReportArchive(
        {
          ...source,
          archiveId: 'different-archive-id'
        },
        {
          documentId: getLegacyReportArchiveDocumentId(
            OWNER_USER_ID,
            String(entry.id)
          )
        }
      )
    ).toThrow(LegacyReportArchiveAdapterError);
  });
});
