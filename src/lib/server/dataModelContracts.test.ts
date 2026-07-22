import { describe, expect, it } from 'vitest';
import {
  DATA_MODEL_METADATA,
  DATA_SCHEMA_VERSION,
  ENTITLEMENT_STATUS_TRANSITIONS,
  ENTITLEMENT_REQUIRES_PAID_PAYMENT,
  ORDER_STATUS_TRANSITIONS,
  PAYMENT_STATUS_TRANSITIONS,
  PRODUCT_CATALOG_SNAPSHOT_STATUS_TRANSITIONS,
  REPORT_ARCHIVE_STATUS_TRANSITIONS,
  REPORT_GENERATION_JOB_STATUS_TRANSITIONS,
  REFUND_ENTITLEMENT_POLICY_DECISION_REQUIRED,
  USER_ACCOUNT_STATUS_TRANSITIONS,
  assertCanIssueActiveEntitlement,
  assertPaymentStatusTransition,
  assertOrderStatusTransition,
  assertOrderStatusUpdate,
  assertProductCanCreateOrder,
  assertReportArchiveOwnership,
  assertReportInputImmutable,
  canAccessExistingProductData,
  canAccessReportArchive,
  canCreateOrderForProduct,
  canTransitionEntitlementStatus,
  canTransitionPaymentStatus,
  canTransitionReportGenerationJobStatus,
  canTransitionOrderStatus,
  evaluateExistingEntitlementAfterPaymentStatus,
  getProductAccessPolicyById,
  getProductCatalogHash,
  getProductCatalogSnapshotId,
  getReportGenerationIdempotencyKey,
  getReportGenerationJobId,
  isIsoDateTime,
  isOrderId,
  isSameReportGenerationRequest,
  validateAdminAuditEvent,
  validateEntitlement,
  validateOrder,
  validatePayment,
  validateProductCatalogSnapshot,
  validateReportArchive,
  validateReportGenerationJob,
  validateUserAccount,
  type AdminAuditEvent,
  type Entitlement,
  type Order,
  type OrderStatus,
  type Payment,
  type ProductCatalogSnapshot,
  type ReportArchive,
  type ReportGenerationJob,
  type UserAccount
} from '../../../cloudrun-api/src/contracts/index.ts';
import {
  SERVER_PRODUCT_CATALOG,
  SERVER_PRODUCT_DISPLAY_NAMES,
  type ServerProductCatalog
} from '../../../cloudrun-api/src/contracts/products.ts';
import { productRegistry } from '../../products/registry.ts';

const NOW = '2026-07-22T00:00:00.000Z';
const LATER = '2026-07-22T00:01:00.000Z';
const ORDER_ID = 'UW-20260722-contract-order-0001';
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const USER_ID = 'kakao-contract-user-001';
const USER_BINDING = 'binding-contract-user-001';

const versioned = {
  schemaVersion: DATA_SCHEMA_VERSION,
  createdAt: NOW,
  updatedAt: NOW,
  idempotencyKey: 'fixture-idempotency-key'
} as const;

function buildCatalogSnapshot(): ProductCatalogSnapshot {
  const effectiveAt = NOW;
  const products = Object.entries(SERVER_PRODUCT_CATALOG).map(([productId, product]) => ({
    productId: productId as keyof typeof SERVER_PRODUCT_CATALOG,
    displayName: productRegistry[productId as keyof typeof productRegistry].displayName,
    amount: product.amount,
    currency: product.currency,
    status: product.status
  }));
  const catalogHash = getProductCatalogHash(products);

  return {
    ...versioned,
    catalogSnapshotId: getProductCatalogSnapshotId(catalogHash, effectiveAt),
    ownerUserId: null,
    productId: null,
    status: 'current',
    effectiveAt,
    catalogHash,
    products
  };
}

function buildOrder(overrides: Partial<Order> = {}): Order {
  return {
    ...versioned,
    orderId: ORDER_ID,
    ownerUserId: USER_ID,
    userBinding: USER_BINDING,
    productId: 'general-signature',
    catalogSnapshotId: HASH_A,
    amount: 79_000,
    currency: 'KRW',
    status: 'created',
    ...overrides
  };
}

function buildPayment(overrides: Partial<Payment> = {}): Payment {
  return {
    ...versioned,
    paymentId: ORDER_ID,
    orderId: ORDER_ID,
    ownerUserId: USER_ID,
    userBinding: USER_BINDING,
    productId: 'general-signature',
    amount: 79_000,
    currency: 'KRW',
    storeId: 'store-contract',
    transactionId: 'transaction-contract',
    provider: 'portone',
    status: 'paid',
    confirmedAt: NOW,
    ...overrides
  };
}

function buildEntitlement(overrides: Partial<Entitlement> = {}): Entitlement {
  return {
    ...versioned,
    entitlementId: HASH_A,
    paymentId: ORDER_ID,
    orderId: ORDER_ID,
    ownerUserId: USER_ID,
    userBinding: USER_BINDING,
    productId: 'general-signature',
    status: 'active',
    issuedAt: NOW,
    ...overrides
  };
}

function buildJob(overrides: Partial<ReportGenerationJob> = {}): ReportGenerationJob {
  return {
    ...versioned,
    jobId: getReportGenerationJobId(HASH_A),
    orderId: ORDER_ID,
    entitlementId: HASH_A,
    ownerUserId: USER_ID,
    userBinding: USER_BINDING,
    productId: 'general-signature',
    inputHash: HASH_B,
    idempotencyKey: getReportGenerationIdempotencyKey(HASH_A, HASH_B),
    status: 'queued',
    attemptCount: 0,
    ...overrides
  };
}

function buildArchive(overrides: Partial<ReportArchive> = {}): ReportArchive {
  return {
    ...versioned,
    archiveId: `general-signature:${ORDER_ID}`,
    orderId: ORDER_ID,
    entitlementId: HASH_A,
    ownerUserId: USER_ID,
    userBinding: USER_BINDING,
    productId: 'general-signature',
    status: 'available',
    reportData: { title: 'fixture' },
    reportProvider: 'gemini',
    reportVersion: 1,
    ...overrides
  };
}

describe('official data model contracts', () => {
  it('defines metadata for all eight schema-version-1 models', () => {
    expect(Object.keys(DATA_MODEL_METADATA)).toEqual([
      'UserAccount',
      'ProductCatalogSnapshot',
      'Order',
      'Payment',
      'Entitlement',
      'ReportGenerationJob',
      'ReportArchive',
      'AdminAuditEvent'
    ]);

    Object.values(DATA_MODEL_METADATA).forEach((metadata) => {
      expect(metadata.serverAuthorityFields).toContain('schemaVersion');
      expect(metadata.retention.automaticDeletionEnabled).toBe(false);
      expect(metadata.idempotencyRule).toBeTruthy();
    });
  });

  it('validates one canonical record for every official model', () => {
    const user: UserAccount = {
      ...versioned,
      userId: USER_ID,
      ownerUserId: USER_ID,
      productId: null,
      provider: 'kakao',
      providerUserId: '123456789',
      status: 'active',
      nickname: 'fixture-user',
      lastAuthenticatedAt: NOW
    };
    const audit: AdminAuditEvent = {
      ...versioned,
      eventId: 'audit-contract-event-001',
      actorAdminId: 'admin-contract-001',
      ownerUserId: USER_ID,
      productId: 'general-signature',
      status: 'succeeded',
      action: 'report.list',
      resourceType: 'reportArchive',
      resourceIdHash: HASH_A,
      requestId: 'request-contract-001',
      metadata: { resultCount: 1 }
    };

    expect(validateUserAccount(user)).toBe(user);
    expect(validateProductCatalogSnapshot(buildCatalogSnapshot())).toBeTruthy();
    expect(validateOrder(buildOrder())).toBeTruthy();
    expect(validatePayment(buildPayment())).toBeTruthy();
    expect(validateEntitlement(buildEntitlement())).toBeTruthy();
    expect(validateReportGenerationJob(buildJob())).toBeTruthy();
    expect(validateReportArchive(buildArchive())).toBeTruthy();
    expect(validateAdminAuditEvent(audit)).toBe(audit);
  });

  it('enforces the live catalog while preserving a valid superseded historical snapshot', () => {
    const current = buildCatalogSnapshot();
    const wrongCurrentName: ProductCatalogSnapshot = {
      ...current,
      products: current.products.map((product) =>
        product.productId === 'general-signature'
          ? { ...product, displayName: '변조된 상품명' }
          : product
      )
    };

    expect(() => validateProductCatalogSnapshot(wrongCurrentName)).toThrowError(
      expect.objectContaining({ code: 'PRODUCT_CATALOG_SNAPSHOT_MISMATCH' })
    );

    const historicalProducts = current.products.map((product) =>
        product.productId === 'general-signature'
          ? { ...product, displayName: '과거 표시 이름', amount: 78_000, status: 'archived' }
          : product
      ).filter((product) => product.productId !== 'money-reading');
    const historicalHash = getProductCatalogHash(historicalProducts);
    const superseded: ProductCatalogSnapshot = {
      ...current,
      status: 'superseded',
      products: historicalProducts,
      catalogHash: historicalHash,
      catalogSnapshotId: getProductCatalogSnapshotId(historicalHash, current.effectiveAt)
    };

    expect(validateProductCatalogSnapshot(superseded)).toBe(superseded);

    const emptyHash = getProductCatalogHash([]);
    const emptySuperseded: ProductCatalogSnapshot = {
      ...superseded,
      products: [],
      catalogHash: emptyHash,
      catalogSnapshotId: getProductCatalogSnapshotId(emptyHash, current.effectiveAt)
    };

    expect(() => validateProductCatalogSnapshot(emptySuperseded)).toThrowError(
      expect.objectContaining({ code: 'PRODUCT_CATALOG_SNAPSHOT_MISMATCH' })
    );
  });

  it('rejects invalid IDs, timestamps, schema versions, and unknown products', () => {
    expect(isOrderId(ORDER_ID)).toBe(true);
    expect(isOrderId('order-001')).toBe(false);
    expect(isIsoDateTime(NOW)).toBe(true);
    expect(isIsoDateTime('2026-07-22')).toBe(false);

    expect(() => validateOrder(buildOrder({ schemaVersion: 2 as 1 }))).toThrowError(
      expect.objectContaining({ code: 'DATA_CONTRACT_SCHEMA_VERSION_UNSUPPORTED' })
    );
    expect(() => validateOrder(buildOrder({ updatedAt: 'not-a-timestamp' }))).toThrowError(
      expect.objectContaining({ code: 'DATA_CONTRACT_INVALID_TIMESTAMP' })
    );
    expect(() =>
      validateOrder(buildOrder({ productId: 'unknown-product' as Order['productId'] }))
    ).toThrowError(expect.objectContaining({ code: 'PRODUCT_UNKNOWN' }));
    expect(() => validateOrder(buildOrder({ refundedAt: LATER }))).toThrowError(
      expect.objectContaining({ code: 'DATA_CONTRACT_STATE_TIMESTAMP_CONFLICT' })
    );
    expect(() => validatePayment(buildPayment({ status: 'pending' }))).toThrowError(
      expect.objectContaining({ code: 'DATA_CONTRACT_STATE_TIMESTAMP_CONFLICT' })
    );
    expect(() =>
      validateEntitlement(buildEntitlement({ revokedAt: LATER, revocationReason: 'fixture' }))
    ).toThrowError(expect.objectContaining({ code: 'DATA_CONTRACT_STATE_TIMESTAMP_CONFLICT' }));
    expect(() =>
      validateOrder({ ...buildOrder(), password: 'fixture-secret' })
    ).toThrowError(expect.objectContaining({ code: 'DATA_CONTRACT_UNKNOWN_FIELD' }));
    expect(() =>
      validateReportGenerationJob({ ...buildJob(), jobId: HASH_A })
    ).toThrowError(
      expect.objectContaining({ code: 'REPORT_GENERATION_IDENTITY_MISMATCH' })
    );
    expect(() =>
      validateReportGenerationJob({
        ...buildJob(),
        idempotencyKey: 'wrong-idempotency-key'
      })
    ).toThrowError(
      expect.objectContaining({ code: 'REPORT_GENERATION_IDENTITY_MISMATCH' })
    );
    expect(() =>
      validateReportGenerationJob(buildJob({ status: 'completed', completedAt: LATER }))
    ).toThrowError(expect.objectContaining({ code: 'DATA_CONTRACT_INVALID_FIELD' }));
  });
});

describe('product policy contract', () => {
  it('preserves the exact five active and seven archived products, names, and prices', () => {
    const active = Object.values(productRegistry)
      .filter((product) => product.status === 'active')
      .map((product) => product.id)
      .sort();
    const archived = Object.values(productRegistry)
      .filter((product) => product.status === 'archived')
      .map((product) => product.id)
      .sort();

    expect(active).toEqual([
      'general-signature',
      'love-reading',
      'love-reunion',
      'match-couple',
      'past-life-goblin'
    ]);
    expect(archived).toHaveLength(7);
    expect(
      Object.fromEntries(
        Object.values(productRegistry).map((product) => [
          product.id,
          [product.displayName, product.price]
        ])
      )
    ).toEqual({
      'general-signature': ['운월선생 정통 종합사주', 79_000],
      'life-flow': ['운월선생 신년운세', 59_000],
      'concern-reading': ['운월당 고민풀이', 2_900],
      'past-life-goblin': ['MZ 도깨비 전생사주', 49_000],
      'love-reading': ['MZ무당 팩폭 연애운', 49_000],
      'love-reunion': ['홍연아씨 재회 가능성', 55_000],
      'match-couple': ['월연도령 사주궁합', 69_000],
      'match-destiny': ['월연도령 운명 궁합', 63_000],
      'marriage-blueprint': ['청연부인 결혼운 설계도', 72_000],
      'marriage-timing': ['청연부인 혼인 시기 리포트', 58_000],
      'career-reading': ['운월선생 직업운 설계도', 59_000],
      'money-reading': ['운월선생 금전운 설계도', 59_000]
    });
    expect(SERVER_PRODUCT_DISPLAY_NAMES).toEqual(
      Object.fromEntries(
        Object.values(productRegistry).map((product) => [product.id, product.displayName])
      )
    );
  });

  it('allows active everywhere, archived only for existing access, and draft nowhere', () => {
    expect(canCreateOrderForProduct('general-signature')).toBe(true);
    expect(canAccessExistingProductData('general-signature')).toBe(true);
    expect(canCreateOrderForProduct('life-flow')).toBe(false);
    expect(canAccessExistingProductData('life-flow')).toBe(true);

    const draftCatalog: ServerProductCatalog = {
      ...SERVER_PRODUCT_CATALOG,
      'general-signature': {
        ...SERVER_PRODUCT_CATALOG['general-signature'],
        status: 'draft'
      }
    };

    expect(getProductAccessPolicyById('general-signature', draftCatalog)).toEqual({
      canStartIntake: false,
      canCreateOrder: false,
      canConfirmExistingPayment: false,
      canRecoverEntitlement: false,
      canReadHistoricalReport: false
    });
    expect(canCreateOrderForProduct('general-signature', draftCatalog)).toBe(false);
    expect(canAccessExistingProductData('general-signature', draftCatalog)).toBe(false);
  });

  it('blocks unknown products', () => {
    expect(canCreateOrderForProduct('unknown-product')).toBe(false);
    expect(canAccessExistingProductData('unknown-product')).toBe(false);
    expect(() => assertProductCanCreateOrder('unknown-product')).toThrowError(
      expect.objectContaining({ code: 'PRODUCT_UNKNOWN' })
    );
  });
});

describe('Order state transitions', () => {
  const allowed = [
    ['created', 'pending'],
    ['pending', 'paid'],
    ['pending', 'failed'],
    ['pending', 'cancelled'],
    ['paid', 'refunded']
  ] as const;

  it('allows only the declared transitions', () => {
    expect(ORDER_STATUS_TRANSITIONS).toEqual({
      created: ['pending'],
      pending: ['paid', 'failed', 'cancelled'],
      paid: ['refunded'],
      failed: [],
      cancelled: [],
      refunded: []
    });

    allowed.forEach(([from, to]) => {
      expect(canTransitionOrderStatus(from, to)).toBe(true);
      expect(() => assertOrderStatusTransition(from, to)).not.toThrow();
    });
  });

  it.each([
    ['failed', 'paid'],
    ['cancelled', 'paid'],
    ['refunded', 'paid'],
    ['created', 'paid'],
    ['paid', 'cancelled']
  ] as [OrderStatus, OrderStatus][])('rejects %s -> %s', (from, to) => {
    expect(canTransitionOrderStatus(from, to)).toBe(false);
    expect(() => assertOrderStatusTransition(from, to)).toThrowError(
      expect.objectContaining({ code: 'ORDER_STATUS_TRANSITION_FORBIDDEN' })
    );
  });

  it('treats a repeated same-state update as an idempotent no-op, not an edge', () => {
    expect(canTransitionOrderStatus('paid', 'paid')).toBe(false);
    expect(assertOrderStatusUpdate('paid', 'paid')).toBe('noop');
  });
});

describe('other model state transitions', () => {
  it('defines server-authoritative transitions for mutable model statuses', () => {
    expect(PAYMENT_STATUS_TRANSITIONS).toEqual({
      pending: ['paid', 'failed', 'cancelled'],
      paid: ['refunded'],
      failed: [],
      cancelled: [],
      refunded: []
    });
    expect(ENTITLEMENT_STATUS_TRANSITIONS).toEqual({
      active: ['revoked'],
      revoked: []
    });
    expect(REPORT_GENERATION_JOB_STATUS_TRANSITIONS).toEqual({
      queued: ['generating', 'cancelled'],
      generating: ['completed', 'failed', 'cancelled'],
      completed: [],
      failed: ['generating', 'cancelled'],
      cancelled: []
    });
    expect(USER_ACCOUNT_STATUS_TRANSITIONS.anonymized).toEqual([]);
    expect(PRODUCT_CATALOG_SNAPSHOT_STATUS_TRANSITIONS).toEqual({
      current: ['superseded'],
      superseded: []
    });
    expect(REPORT_ARCHIVE_STATUS_TRANSITIONS).toEqual({
      available: ['deleted'],
      deleted: []
    });
  });

  it('accepts allowed edges and rejects resurrection edges', () => {
    expect(canTransitionPaymentStatus('pending', 'paid')).toBe(true);
    expect(() => assertPaymentStatusTransition('paid', 'refunded')).not.toThrow();
    expect(() => assertPaymentStatusTransition('refunded', 'paid')).toThrowError(
      expect.objectContaining({ code: 'PAYMENT_STATUS_TRANSITION_FORBIDDEN' })
    );
    expect(canTransitionEntitlementStatus('revoked', 'active')).toBe(false);
    expect(canTransitionReportGenerationJobStatus('failed', 'generating')).toBe(true);
    expect(canTransitionReportGenerationJobStatus('completed', 'generating')).toBe(false);
  });
});

describe('payment and entitlement separation', () => {
  it('issues an active entitlement only after paid', () => {
    expect(() => assertCanIssueActiveEntitlement('paid')).not.toThrow();

    (['pending', 'failed', 'cancelled', 'refunded'] as const).forEach((status) => {
      expect(() => assertCanIssueActiveEntitlement(status)).toThrowError(
        expect.objectContaining({ code: ENTITLEMENT_REQUIRES_PAID_PAYMENT })
      );
    });
  });

  it('keeps an existing active entitlement unchanged on refund and exposes the decision point', () => {
    expect(evaluateExistingEntitlementAfterPaymentStatus('refunded', 'active')).toEqual({
      action: 'policy-decision-required',
      code: REFUND_ENTITLEMENT_POLICY_DECISION_REQUIRED,
      entitlementStatus: 'active',
      automaticallyRevoked: false
    });
  });
});

describe('report generation and archive guards', () => {
  it('derives stable entitlement/input idempotency and forbids input replacement', () => {
    const existing = { entitlementId: HASH_A, inputHash: HASH_B };

    expect(getReportGenerationJobId(HASH_A)).toHaveLength(64);
    expect(getReportGenerationJobId(HASH_A)).toBe(getReportGenerationJobId(HASH_A));
    expect(getReportGenerationIdempotencyKey(HASH_A, HASH_B)).toBe(
      getReportGenerationIdempotencyKey(HASH_A, HASH_B)
    );
    expect(isSameReportGenerationRequest(existing, HASH_A, HASH_B)).toBe(true);
    expect(() => assertReportInputImmutable(existing, HASH_A, HASH_B)).not.toThrow();
    expect(() => assertReportInputImmutable(existing, HASH_A, 'c'.repeat(64))).toThrowError(
      expect.objectContaining({ code: 'REPORT_INPUT_CONFLICT' })
    );
  });

  it('masks a foreign archive as not found', () => {
    const archive = buildArchive();

    expect(canAccessReportArchive(archive, USER_ID)).toBe(true);
    expect(canAccessReportArchive(archive, 'other-user')).toBe(false);
    expect(() => assertReportArchiveOwnership(archive, 'other-user')).toThrowError(
      expect.objectContaining({ code: 'REPORT_ARCHIVE_NOT_FOUND', status: 404 })
    );
    expect(() => assertReportArchiveOwnership(null, USER_ID)).toThrowError(
      expect.objectContaining({ code: 'REPORT_ARCHIVE_NOT_FOUND', status: 404 })
    );
  });

  it('keeps archived products eligible for historical report recovery', () => {
    expect(SERVER_PRODUCT_CATALOG['life-flow'].status).toBe('archived');
    expect(canAccessExistingProductData('life-flow')).toBe(true);
  });
});
