import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../cloudrun-api/src/config/env.ts';
import type { ReportAccessClaims } from '../../cloudrun-api/src/contracts/auth.ts';
import { AdminService } from '../../cloudrun-api/src/domains/admin/adminService.ts';
import {
  ArchiveService,
  type ArchiveEntry,
  type ArchiveRepository
} from '../../cloudrun-api/src/domains/archives/archiveService.ts';
import { TokenService } from '../../cloudrun-api/src/domains/auth/tokenService.ts';
import {
  PaymentService,
  type ConfirmedPaymentLedgerRecord,
  type PaymentLedgerRecord,
  type PaymentLedgerRepository
} from '../../cloudrun-api/src/domains/payments/paymentService.ts';
import type {
  PortOnePayment,
  PortOnePaymentClient
} from '../../cloudrun-api/src/domains/payments/portoneClient.ts';
import {
  ReportService,
  type ReportLedger,
  type ReportLedgerRepository,
  type ReportResponsePayload
} from '../../cloudrun-api/src/domains/reports/reportService.ts';

const FIXED_NOW = Date.parse('2026-07-22T00:00:00.000Z');
const USER_TOKEN_TTL_MS = 60_000;
const ADMIN_TOKEN_TTL_MS = 120_000;
const USER_A = 'fixture-user-a';
const USER_B = 'fixture-user-b';
const ADMIN_ID = 'fixture-admin';
const ADMIN_PASSWORD = 'fixture-admin-password-not-for-production';
const ADMIN_CREDENTIAL_HASH = createHash('sha256')
  .update(`${ADMIN_ID}:${ADMIN_PASSWORD}`)
  .digest('hex');
const PRODUCT_ID = 'general-signature';
const PRODUCT_PRICE = 79_000;
const ORDER_ID = 'UW-20260722-quality-contract-0001';
const TRANSACTION_ID = 'tx-quality-contract-0001';
const STORE_ID = 'store-quality-fixture';

function createFixtureConfig() {
  return loadConfig({
    NODE_ENV: 'production',
    REPORT_ACCESS_SECRET: 'fixture-report-access-secret-not-for-production',
    USER_ACCESS_SECRET: 'fixture-user-access-secret-not-for-production',
    ADMIN_ACCESS_SECRET: 'fixture-admin-access-secret-not-for-production',
    AUTH_ACCESS_TOKEN_TTL_MS: String(USER_TOKEN_TTL_MS),
    ADMIN_ACCESS_TOKEN_TTL_MS: String(ADMIN_TOKEN_TTL_MS),
    REPORT_ACCESS_TOKEN_TTL_MS: '1800000',
    PAYMENT_ORDER_CLAIM_TTL_MS: '7200000',
    ADMIN_CREDENTIAL_HASH,
    PORTONE_STORE_ID: STORE_ID
  });
}

function createReportToken(
  tokens: TokenService,
  userId: string,
  orderId: string,
  productId = PRODUCT_ID
) {
  return tokens.createReportAccessToken({
    userId,
    orderId,
    paymentId: orderId,
    productId,
    amount: PRODUCT_PRICE,
    entitlementId: `fixture-entitlement-${userId}`
  });
}

function createArchiveEntry(
  id: string,
  orderId: string,
  productId = PRODUCT_ID
): ArchiveEntry {
  return {
    id,
    orderId,
    productId,
    customerName: 'Fixture Customer',
    title: 'Fixture Report',
    subtitle: 'Integration contract fixture',
    createdAt: '2026-07-22T00:00:00.000Z',
    reportData: { fixture: true }
  };
}

class FakeArchiveRepository implements ArchiveRepository {
  readonly entriesByUser = new Map<string, ArchiveEntry[]>();
  readonly listCalls: Array<string | undefined> = [];

  async upsert(userId: string, entry: ArchiveEntry, _entryJson: string) {
    const current = this.entriesByUser.get(userId) || [];
    const withoutSameId = current.filter((candidate) => candidate.id !== entry.id);
    this.entriesByUser.set(userId, [...withoutSameId, { ...entry }]);
  }

  async list(whereUserId?: string) {
    this.listCalls.push(whereUserId);

    if (whereUserId) {
      return [...(this.entriesByUser.get(whereUserId) || [])];
    }

    return [...this.entriesByUser.values()].flat();
  }
}

const REPORT_CLAIMS: ReportAccessClaims = {
  orderId: ORDER_ID,
  paymentId: ORDER_ID,
  productId: PRODUCT_ID,
  amount: PRODUCT_PRICE,
  userBinding: 'fixture-report-user-binding',
  entitlementId: 'fixture-report-entitlement'
};

function createReportLedger(overrides: Partial<ReportLedger> = {}): ReportLedger {
  return {
    documentId: 'fixture-payment-ledger',
    path: '/fixtureLedgers/fixture-payment-ledger',
    paymentId: REPORT_CLAIMS.paymentId,
    orderId: REPORT_CLAIMS.orderId,
    productId: REPORT_CLAIMS.productId,
    amount: REPORT_CLAIMS.amount,
    currency: 'KRW',
    storeId: STORE_ID,
    transactionId: TRANSACTION_ID,
    confirmedAt: '2026-07-22T00:00:01.000Z',
    userId: USER_A,
    userBinding: REPORT_CLAIMS.userBinding,
    entitlementId: REPORT_CLAIMS.entitlementId,
    orderClaimHash: 'a'.repeat(64),
    entitlementStatus: 'active',
    entitlementCreatedAt: '2026-07-22T00:00:01.000Z',
    reportInputHash: '',
    reportGenerationStatus: '',
    reportGenerationLockId: '',
    reportGenerationLockExpiresAt: '',
    reportGenerationStartedAt: '',
    reportGenerationAttempt: 0,
    reportGenerationCompletedAt: '',
    reportGenerationFailedAt: '',
    reportGenerationFailure: '',
    reportJson: '',
    reportJsonHash: '',
    createTime: '2026-07-22T00:00:01.000Z',
    updateTime: '2026-07-22T00:00:01.000Z',
    ...overrides
  };
}

type AcquireInput = Parameters<ReportLedgerRepository['acquireReportGeneration']>[1];
type CompleteInput = Parameters<ReportLedgerRepository['completeReportGeneration']>[1];
type FailInput = Parameters<ReportLedgerRepository['failReportGeneration']>[1];

class SingleLedgerRepository implements ReportLedgerRepository {
  constructor(private readonly ledger: ReportLedger) {}

  async get(_paymentId: string) {
    return { ...this.ledger };
  }

  async acquireReportGeneration(_ledger: ReportLedger, _input: AcquireInput) {
    return { ...this.ledger };
  }

  async completeReportGeneration(_ledger: ReportLedger, _input: CompleteInput) {
    return { ...this.ledger };
  }

  async failReportGeneration(_ledger: ReportLedger, _input: FailInput) {
    return { ...this.ledger };
  }

  isPreconditionConflict(_error: unknown) {
    return false;
  }
}

class FakePortOneClient implements PortOnePaymentClient {
  payment: PortOnePayment = {};
  readonly requestedPaymentIds: string[] = [];

  async fetchPayment(paymentId: string) {
    this.requestedPaymentIds.push(paymentId);
    return this.payment;
  }
}

class ExistingPaymentLedgerRepository implements PaymentLedgerRepository {
  createCalls = 0;
  getCalls = 0;
  lastRecord: ConfirmedPaymentLedgerRecord | null = null;

  async createPaymentLedger(record: ConfirmedPaymentLedgerRecord) {
    this.createCalls += 1;
    this.lastRecord = { ...record };

    return {
      kind: 'existing' as const,
      ledger: { ...record }
    };
  }

  async getPaymentLedger(_entitlementId: string): Promise<PaymentLedgerRecord | null> {
    this.getCalls += 1;
    return this.lastRecord ? { ...this.lastRecord } : null;
  }

  async listPaymentLedgersByUserId(_userId: string, _limit: number) {
    return [];
  }
}

function createPaymentHarness(paidAmount = PRODUCT_PRICE) {
  const config = createFixtureConfig();
  const tokens = new TokenService(config);
  const portOne = new FakePortOneClient();
  const ledger = new ExistingPaymentLedgerRepository();
  const payments = new PaymentService({
    config: {
      storeId: STORE_ID,
      orderClaimTtlMs: config.report.orderClaimTtlMs,
      reportAccessTokenTtlMs: config.report.accessTokenTtlMs
    },
    portOneClient: portOne,
    ledgerRepository: ledger,
    tokenService: tokens,
    now: () => FIXED_NOW,
    randomBytes: (size) => Buffer.alloc(size, 7)
  });
  const order = payments.createOrderIntent(
    { userId: USER_A },
    { orderId: ORDER_ID, productId: PRODUCT_ID }
  );

  portOne.payment = {
    id: ORDER_ID,
    status: 'PAID',
    storeId: STORE_ID,
    currency: 'KRW',
    amount: { total: paidAmount },
    transactionId: TRANSACTION_ID,
    customData: {
      productId: PRODUCT_ID,
      orderClaim: order.orderClaim
    },
    method: { type: 'CARD' },
    paidAt: '2026-07-22T00:00:01.000Z'
  };

  return {
    tokens,
    portOne,
    ledger,
    payments,
    confirmationBody: {
      paymentId: ORDER_ID,
      orderId: ORDER_ID,
      productId: PRODUCT_ID,
      amount: PRODUCT_PRICE,
      txId: TRANSACTION_ID,
      orderClaim: order.orderClaim
    }
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Cloud Run quality integration contracts', () => {
  it('uses the exact user-token expiry and separates user and admin purposes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    const config = createFixtureConfig();
    const tokens = new TokenService(config);
    const userToken = tokens.createUserAccessToken({ id: USER_A });
    const adminToken = tokens.createAdminAccessToken(ADMIN_ID);
    const signedClaims = tokens.verifySignedAccessToken(userToken, 'user');

    expect(signedClaims).toMatchObject({
      purpose: 'user',
      sub: USER_A,
      iat: FIXED_NOW,
      exp: FIXED_NOW + USER_TOKEN_TTL_MS
    });
    expect(() => tokens.verifyAdminAccessToken(userToken)).toThrow();
    expect(() => tokens.verifyUserAccessToken(adminToken)).toThrow();

    vi.setSystemTime(FIXED_NOW + USER_TOKEN_TTL_MS - 1);
    expect(tokens.verifyUserAccessToken(userToken)).toMatchObject({ userId: USER_A });

    vi.setSystemTime(FIXED_NOW + USER_TOKEN_TTL_MS);
    expect(() => tokens.verifyUserAccessToken(userToken)).toThrow(
      'Access token has expired.'
    );
  });

  it('issues an admin token only for the exact fixture credential', () => {
    const config = createFixtureConfig();
    const tokens = new TokenService(config);
    const admin = new AdminService(config, tokens);
    const authenticated = admin.login({
      adminId: ADMIN_ID,
      password: ADMIN_PASSWORD
    });

    expect(tokens.verifyAdminAccessToken(authenticated.adminAccessToken)).toMatchObject({
      purpose: 'admin',
      sub: ADMIN_ID
    });
    expect(authenticated.expiresInMs).toBe(ADMIN_TOKEN_TTL_MS);
    expect(() =>
      admin.login({ adminId: ADMIN_ID, password: 'fixture-wrong-password' })
    ).toThrow('Admin id or password is incorrect.');
    expect(() =>
      admin.login({ adminId: 'fixture-wrong-admin', password: ADMIN_PASSWORD })
    ).toThrow('Admin id or password is incorrect.');
  });

  it('rejects cross-user archive tokens and keeps repository lists user-scoped', async () => {
    const config = createFixtureConfig();
    const tokens = new TokenService(config);
    const repository = new FakeArchiveRepository();
    const archives = new ArchiveService(config, repository, tokens);
    const userAOrder = 'UW-20260722-archive-user-a-0001';
    const userBOrder = 'UW-20260722-archive-user-b-0001';
    const userAToken = createReportToken(tokens, USER_A, userAOrder);
    const userBToken = createReportToken(tokens, USER_B, userBOrder);

    await expect(
      archives.save(USER_B, {
        entry: createArchiveEntry('archive-cross-user', userAOrder),
        reportAccessToken: userAToken
      })
    ).rejects.toMatchObject({ status: 403 });

    await archives.save(USER_A, {
      entry: createArchiveEntry('archive-user-a', userAOrder),
      reportAccessToken: userAToken
    });
    await archives.save(USER_B, {
      entry: createArchiveEntry('archive-user-b', userBOrder),
      reportAccessToken: userBToken
    });

    await expect(archives.list(USER_A)).resolves.toMatchObject([
      { id: 'archive-user-a' }
    ]);
    await expect(archives.list(USER_B)).resolves.toMatchObject([
      { id: 'archive-user-b' }
    ]);
    expect(repository.listCalls).toEqual([USER_A, USER_B]);
  });

  it('rejects archive order and product mismatches', async () => {
    const config = createFixtureConfig();
    const tokens = new TokenService(config);
    const repository = new FakeArchiveRepository();
    const archives = new ArchiveService(config, repository, tokens);
    const token = createReportToken(tokens, USER_A, ORDER_ID);

    await expect(
      archives.save(USER_A, {
        entry: createArchiveEntry(
          'archive-order-mismatch',
          'UW-20260722-different-order-0001'
        ),
        reportAccessToken: token
      })
    ).rejects.toMatchObject({ status: 403 });

    await expect(
      archives.save(USER_A, {
        entry: createArchiveEntry('archive-product-mismatch', ORDER_ID, 'love-reading'),
        reportAccessToken: token
      })
    ).rejects.toMatchObject({ status: 403 });
    expect(repository.entriesByUser.size).toBe(0);
  });

  it.each(['orderId', 'productId', 'userBinding', 'entitlementId'] as const)(
    'rejects a report ledger whose %s differs from the token claim',
    async (field) => {
      const config = createFixtureConfig();
      const ledger = createReportLedger({
        [field]: `fixture-mismatched-${field}`
      } as Partial<ReportLedger>);
      const repository = new SingleLedgerRepository(ledger);
      const generator = vi.fn(async () => ({
        provider: 'gemini'
      } as unknown as ReportResponsePayload));
      const reports = new ReportService(config, repository, generator);

      await expect(
        reports.generate(REPORT_CLAIMS, {
          serviceId: PRODUCT_ID,
          payload: { fixture: true }
        })
      ).rejects.toMatchObject({
        status: 403,
        message: 'Report token does not match the confirmed payment ledger.'
      });
      expect(generator).not.toHaveBeenCalled();
    }
  );

  it('rejects a PortOne paid amount that differs from the server catalog', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    const harness = createPaymentHarness(PRODUCT_PRICE - 1);

    await expect(
      harness.payments.confirmPayment(
        { userId: USER_A },
        harness.confirmationBody
      )
    ).rejects.toMatchObject({ status: 409 });
    expect(harness.portOne.requestedPaymentIds).toEqual([ORDER_ID]);
    expect(harness.ledger.createCalls).toBe(0);
  });

  it('accepts the repository existing-ledger result as an idempotent confirmation', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    const harness = createPaymentHarness();
    const confirmed = await harness.payments.confirmPayment(
      { userId: USER_A },
      harness.confirmationBody
    );
    const reportClaims = harness.tokens.verifyReportAccessToken(
      confirmed.reportAccessToken
    );

    expect(harness.ledger.createCalls).toBe(1);
    expect(harness.ledger.getCalls).toBe(0);
    expect(harness.ledger.lastRecord).toMatchObject({
      paymentId: ORDER_ID,
      orderId: ORDER_ID,
      productId: PRODUCT_ID,
      amount: PRODUCT_PRICE,
      userId: USER_A,
      entitlementStatus: 'active'
    });
    expect(reportClaims).toMatchObject({
      paymentId: ORDER_ID,
      orderId: ORDER_ID,
      productId: PRODUCT_ID,
      amount: PRODUCT_PRICE,
      entitlementId: harness.ledger.lastRecord?.entitlementId
    });
  });
});
