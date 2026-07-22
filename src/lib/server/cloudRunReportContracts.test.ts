import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../../cloudrun-api/src/config/env.ts';
import type { ReportAccessClaims } from '../../../cloudrun-api/src/contracts/auth.ts';
import {
  ReportGenerationInProgressError,
  ReportRequestError
} from '../../../cloudrun-api/src/contracts/errors.ts';
import {
  SERVER_PRODUCT_CATALOG,
  type ServerProductCatalog
} from '../../../cloudrun-api/src/contracts/products.ts';
import {
  ReportService,
  type ReportLedger,
  type ReportLedgerRepository,
  type ReportResponsePayload
} from '../../../cloudrun-api/src/domains/reports/reportService.ts';

const FIXED_NOW = Date.parse('2026-01-15T03:00:00.000Z');
const REPORT_BODY = {
  serviceId: 'general-signature',
  payload: {
    fixture: 'contract-v1'
  }
};
const CLAIMS: ReportAccessClaims = {
  orderId: 'UW-CONTRACT-ORDER-0001',
  paymentId: 'UW-CONTRACT-ORDER-0001',
  productId: 'general-signature',
  amount: 79_000,
  userBinding: 'fixture-user-binding',
  entitlementId: 'fixture-entitlement-id'
};

function createPayload(
  provider: 'gemini' | 'deterministic-fallback' = 'gemini'
): ReportResponsePayload {
  return {
    provider,
    reportMode: 'fixture-report-mode',
    promptVersion: 'fixture-prompt-version',
    report: {
      title: 'Contract fixture report',
      summary: 'Contract fixture summary',
      sections: []
    }
  } as unknown as ReportResponsePayload;
}

function createLedger(overrides: Partial<ReportLedger> = {}): ReportLedger {
  return {
    documentId: 'fixture-ledger-document',
    path: '/fixtureLedgers/fixture-ledger-document',
    updateTime: '2026-01-15T02:59:00.000Z',
    paymentId: CLAIMS.paymentId,
    orderId: CLAIMS.orderId,
    productId: CLAIMS.productId,
    amount: CLAIMS.amount,
    userBinding: CLAIMS.userBinding,
    entitlementId: CLAIMS.entitlementId,
    entitlementStatus: 'active',
    reportInputHash: '',
    reportGenerationStatus: '',
    reportGenerationLockExpiresAt: '',
    reportGenerationAttempt: 0,
    reportJson: '',
    reportJsonHash: '',
    ...overrides
  };
}

type AcquireInput = Parameters<ReportLedgerRepository['acquireReportGeneration']>[1];
type CompleteInput = Parameters<ReportLedgerRepository['completeReportGeneration']>[1];
type FailInput = Parameters<ReportLedgerRepository['failReportGeneration']>[1];
type ConflictMode = 'none' | 'completed' | 'generating';

class FakeReportLedgerRepository implements ReportLedgerRepository {
  private ledger: ReportLedger;
  private version = 0;
  private conflictMode: ConflictMode = 'none';
  private conflictPayload = createPayload();
  private readonly preconditionConflict = new Error('fixture-precondition-conflict');

  readonly getCalls: string[] = [];
  readonly acquireCalls: AcquireInput[] = [];
  readonly completeCalls: CompleteInput[] = [];
  readonly failCalls: FailInput[] = [];

  constructor(initialLedger: ReportLedger = createLedger()) {
    this.ledger = { ...initialLedger };
  }

  private nextUpdateTime() {
    this.version += 1;
    return new Date(FIXED_NOW + this.version * 1_000).toISOString();
  }

  private snapshot() {
    return { ...this.ledger };
  }

  setAcquireConflict(mode: Exclude<ConflictMode, 'none'>, payload = createPayload()) {
    this.conflictMode = mode;
    this.conflictPayload = payload;
  }

  tamperCacheHash() {
    this.ledger.reportJsonHash = '0'.repeat(64);
  }

  currentLedger() {
    return this.snapshot();
  }

  async get(paymentId: string) {
    this.getCalls.push(paymentId);
    return this.snapshot();
  }

  async acquireReportGeneration(_ledger: ReportLedger, input: AcquireInput) {
    this.acquireCalls.push({ ...input });

    if (this.conflictMode !== 'none') {
      const reportJson = JSON.stringify(this.conflictPayload);
      this.ledger = {
        ...this.ledger,
        updateTime: this.nextUpdateTime(),
        reportInputHash: input.inputHash,
        reportGenerationStatus: this.conflictMode,
        reportGenerationLockExpiresAt:
          this.conflictMode === 'generating'
            ? new Date(FIXED_NOW + 60_000).toISOString()
            : '',
        reportJson: this.conflictMode === 'completed' ? reportJson : '',
        reportJsonHash:
          this.conflictMode === 'completed'
            ? createHash('sha256').update(reportJson).digest('hex')
            : ''
      };
      throw this.preconditionConflict;
    }

    this.ledger = {
      ...this.ledger,
      updateTime: this.nextUpdateTime(),
      reportInputHash: input.inputHash,
      reportGenerationStatus: 'generating',
      reportGenerationLockExpiresAt: input.lockExpiresAt,
      reportGenerationAttempt: input.attempt,
      reportJson: '',
      reportJsonHash: ''
    };
    return this.snapshot();
  }

  async completeReportGeneration(_ledger: ReportLedger, input: CompleteInput) {
    this.completeCalls.push({ ...input });
    this.ledger = {
      ...this.ledger,
      updateTime: this.nextUpdateTime(),
      reportGenerationStatus: 'completed',
      reportGenerationLockExpiresAt: '',
      reportJson: input.reportJson,
      reportJsonHash: input.reportJsonHash
    };
    return this.snapshot();
  }

  async failReportGeneration(_ledger: ReportLedger, input: FailInput) {
    this.failCalls.push({ ...input });
    this.ledger = {
      ...this.ledger,
      updateTime: this.nextUpdateTime(),
      reportGenerationStatus: 'failed',
      reportGenerationLockExpiresAt: input.failedAt,
      reportJson: '',
      reportJsonHash: ''
    };
    return this.snapshot();
  }

  isPreconditionConflict(error: unknown) {
    return error === this.preconditionConflict;
  }
}

const config = loadConfig({
  NODE_ENV: 'test',
  REPORT_GENERATION_LOCK_TTL_MS: '120000'
});

describe('Cloud Run paid report persistence contracts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('acquires and completes once, then serves the identical input from cache', async () => {
    const repository = new FakeReportLedgerRepository();
    const payload = createPayload();
    const generator = vi.fn(async () => payload);
    const service = new ReportService(config, repository, generator);

    await expect(service.generate(CLAIMS, REPORT_BODY)).resolves.toEqual(payload);
    await expect(service.generate(CLAIMS, REPORT_BODY)).resolves.toEqual(payload);

    expect(generator).toHaveBeenCalledTimes(1);
    expect(repository.acquireCalls).toHaveLength(1);
    expect(repository.completeCalls).toHaveLength(1);
    expect(repository.failCalls).toHaveLength(0);
    expect(repository.currentLedger()).toMatchObject({
      reportGenerationStatus: 'completed',
      reportGenerationAttempt: 1
    });
  });

  it('rejects a different input after the payment has been bound', async () => {
    const repository = new FakeReportLedgerRepository();
    const generator = vi.fn(async () => createPayload());
    const service = new ReportService(config, repository, generator);

    await service.generate(CLAIMS, REPORT_BODY);

    await expect(
      service.generate(CLAIMS, {
        ...REPORT_BODY,
        payload: { fixture: 'different-contract-input' }
      })
    ).rejects.toMatchObject({
      status: 409,
      code: 'REPORT_INPUT_CONFLICT',
      message: 'This payment has already been bound to a different report input.'
    });
    expect(generator).toHaveBeenCalledTimes(1);
  });

  it('reports a future generation lease as an in-progress retry', async () => {
    const repository = new FakeReportLedgerRepository(
      createLedger({
        reportGenerationStatus: 'generating',
        reportGenerationLockExpiresAt: new Date(FIXED_NOW + 60_000).toISOString()
      })
    );
    const generator = vi.fn(async () => createPayload());
    const service = new ReportService(config, repository, generator);

    const error = await service.generate(CLAIMS, REPORT_BODY).catch((caught) => caught);

    expect(error).toBeInstanceOf(ReportGenerationInProgressError);
    expect(error).toMatchObject({
      status: 409,
      code: 'REPORT_GENERATION_IN_PROGRESS',
      retryAfterSeconds: 3
    });
    expect(generator).not.toHaveBeenCalled();
    expect(repository.acquireCalls).toHaveLength(0);
  });

  it('reacquires an expired generation lease', async () => {
    const repository = new FakeReportLedgerRepository(
      createLedger({
        reportGenerationStatus: 'generating',
        reportGenerationLockExpiresAt: new Date(FIXED_NOW - 1).toISOString(),
        reportGenerationAttempt: 2
      })
    );
    const payload = createPayload();
    const generator = vi.fn(async () => payload);
    const service = new ReportService(config, repository, generator);

    await expect(service.generate(CLAIMS, REPORT_BODY)).resolves.toEqual(payload);

    expect(repository.acquireCalls).toHaveLength(1);
    expect(repository.acquireCalls[0].attempt).toBe(3);
    expect(repository.completeCalls).toHaveLength(1);
    expect(generator).toHaveBeenCalledTimes(1);
  });

  it('returns deterministic fallback but fails the lease and never caches it', async () => {
    const repository = new FakeReportLedgerRepository();
    const fallback = createPayload('deterministic-fallback');
    const generator = vi.fn(async () => fallback);
    const service = new ReportService(config, repository, generator);

    await expect(service.generate(CLAIMS, REPORT_BODY)).resolves.toEqual(fallback);
    await expect(service.generate(CLAIMS, REPORT_BODY)).resolves.toEqual(fallback);

    expect(generator).toHaveBeenCalledTimes(2);
    expect(repository.acquireCalls).toHaveLength(2);
    expect(repository.failCalls).toHaveLength(2);
    expect(repository.completeCalls).toHaveLength(0);
    expect(repository.currentLedger()).toMatchObject({
      reportGenerationStatus: 'failed',
      reportJson: '',
      reportJsonHash: ''
    });
  });

  it('returns a completed cache after an acquire precondition conflict', async () => {
    const repository = new FakeReportLedgerRepository();
    const cachedPayload = createPayload();
    repository.setAcquireConflict('completed', cachedPayload);
    const generator = vi.fn(async () => createPayload());
    const service = new ReportService(config, repository, generator);

    await expect(service.generate(CLAIMS, REPORT_BODY)).resolves.toEqual(cachedPayload);

    expect(repository.getCalls).toHaveLength(2);
    expect(repository.acquireCalls).toHaveLength(1);
    expect(repository.completeCalls).toHaveLength(0);
    expect(generator).not.toHaveBeenCalled();
  });

  it('reports in-progress after an acquire conflict rereads a generating ledger', async () => {
    const repository = new FakeReportLedgerRepository();
    repository.setAcquireConflict('generating');
    const generator = vi.fn(async () => createPayload());
    const service = new ReportService(config, repository, generator);

    await expect(service.generate(CLAIMS, REPORT_BODY)).rejects.toMatchObject({
      status: 409,
      code: 'REPORT_GENERATION_IN_PROGRESS',
      retryAfterSeconds: 3
    });
    expect(repository.getCalls).toHaveLength(2);
    expect(repository.acquireCalls).toHaveLength(1);
    expect(generator).not.toHaveBeenCalled();
  });

  it('rejects a completed cache whose integrity hash was tampered with', async () => {
    const repository = new FakeReportLedgerRepository();
    const generator = vi.fn(async () => createPayload());
    const service = new ReportService(config, repository, generator);

    await service.generate(CLAIMS, REPORT_BODY);
    repository.tamperCacheHash();

    const error = await service.generate(CLAIMS, REPORT_BODY).catch((caught) => caught);

    expect(error).toBeInstanceOf(ReportRequestError);
    expect(error).toMatchObject({
      status: 503,
      message: 'The saved report cache failed its integrity check.'
    });
    expect(generator).toHaveBeenCalledTimes(1);
  });

  it('blocks report generation when an entitled product is moved to draft', async () => {
    const repository = new FakeReportLedgerRepository();
    const generator = vi.fn(async () => createPayload());
    const draftCatalog: ServerProductCatalog = {
      ...SERVER_PRODUCT_CATALOG,
      'general-signature': {
        ...SERVER_PRODUCT_CATALOG['general-signature'],
        status: 'draft'
      }
    };
    const service = new ReportService(
      config,
      repository,
      generator,
      draftCatalog
    );

    await expect(service.generate(CLAIMS, REPORT_BODY)).rejects.toMatchObject({ status: 409 });
    expect(repository.acquireCalls).toHaveLength(0);
    expect(generator).not.toHaveBeenCalled();
  });

  it('allows archived products to replay a completed cache but never starts a new generation', async () => {
    const repository = new FakeReportLedgerRepository();
    const payload = createPayload();
    const generator = vi.fn(async () => payload);
    const activeService = new ReportService(config, repository, generator);

    await activeService.generate(CLAIMS, REPORT_BODY);

    const archivedCatalog: ServerProductCatalog = {
      ...SERVER_PRODUCT_CATALOG,
      'general-signature': {
        ...SERVER_PRODUCT_CATALOG['general-signature'],
        status: 'archived'
      }
    };
    const archivedService = new ReportService(
      config,
      repository,
      generator,
      archivedCatalog
    );

    await expect(archivedService.generate(CLAIMS, REPORT_BODY)).resolves.toEqual(payload);
    expect(generator).toHaveBeenCalledTimes(1);

    const emptyRepository = new FakeReportLedgerRepository();
    const emptyArchivedService = new ReportService(
      config,
      emptyRepository,
      generator,
      archivedCatalog
    );
    await expect(
      emptyArchivedService.generate(CLAIMS, REPORT_BODY)
    ).rejects.toMatchObject({ status: 409 });
    expect(emptyRepository.acquireCalls).toHaveLength(0);
    expect(generator).toHaveBeenCalledTimes(1);
  });
});
