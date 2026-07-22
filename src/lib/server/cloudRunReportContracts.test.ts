import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../../cloudrun-api/src/config/env.ts';
import type { ReportAccessClaims } from '../../../cloudrun-api/src/contracts/auth.ts';
import { ReportGenerationInProgressError } from '../../../cloudrun-api/src/contracts/errors.ts';
import { REPORT_CACHE_SCHEMA_VERSION } from '../../../cloudrun-api/src/domains/reports/reportPayload.ts';
import {
  ReportService,
  type ReportGenerationContext,
  type NormalizedReportRequest,
  type ReportLedger,
  type ReportLedgerRepository,
  type ReportResponsePayload
} from '../../../cloudrun-api/src/domains/reports/reportService.ts';
import {
  REPORT_TELEMETRY_KEYS,
  type ReportGenerationTelemetryEvent
} from '../../../cloudrun-api/src/domains/reports/telemetry.ts';
import {
  REPORT_GENERATION_META_SCHEMA_VERSION,
  REPORT_REQUEST_SCHEMA_VERSION,
  REPORT_RESPONSE_SCHEMA_VERSION,
  parseReportRequestV1
} from '../../features/reports/contracts.ts';

const FIXED_NOW = Date.parse('2026-01-15T03:00:00.000Z');
const REFERENCE_INSTANT = '2026-01-10T11:30:00.000Z';

const parsedReportBody = parseReportRequestV1({
  schemaVersion: REPORT_REQUEST_SCHEMA_VERSION,
  serviceId: 'general-signature',
  payload: {
    serviceId: 'general-signature',
    serviceLabel: 'Fixture report',
    timezone: 'Asia/Seoul',
    user: {
      name: 'Sensitive Fixture Name',
      gender: 'female'
    },
    birth: {
      calendar: 'solar',
      isLeapMonth: false,
      date: '1990-01-01',
      time: '12:00',
      isUnknownTime: false,
      precision: 'exact',
      dayBoundaryPolicy: 'midnight',
      location: null
    },
    partner: null,
    relationship: {
      status: null,
      duration: null,
      microChoice: null,
      focus: null,
      summary: ''
    },
    pastLifeContext: null,
    questions: ['Sensitive fixture question']
  },
  reportMode: 'fixture-report-mode',
  promptVersion: 'fixture-prompt-version'
});
const { orderId: omittedOrderId, ...REPORT_BODY } = parsedReportBody;
void omittedOrderId;

const CLAIMS: ReportAccessClaims = {
  orderId: 'UW-CONTRACT-ORDER-0001',
  paymentId: 'UW-CONTRACT-PAYMENT-0001',
  productId: 'general-signature',
  amount: 79_000,
  userBinding: 'fixture-user-binding',
  entitlementId: 'fixture-entitlement-id'
};

function canonicalFixture(value: unknown): string {
  if (value === null) return 'null';
  if (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    typeof value === 'number'
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalFixture).join(',')}]`;
  }
  const source = value as Record<string, unknown>;
  return `{${Object.keys(source)
    .filter((key) => source[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalFixture(source[key])}`)
    .join(',')}}`;
}

function legacyInputHash(body: NormalizedReportRequest) {
  const { schemaVersion: _schemaVersion, ...request } = body;
  void _schemaVersion;
  return createHash('sha256').update(canonicalFixture({
    version: 'unwoldang-report-input-v1',
    paymentId: CLAIMS.paymentId,
    orderId: CLAIMS.orderId,
    productId: CLAIMS.productId,
    amount: CLAIMS.amount,
    request
  })).digest('hex');
}

function createPayload(
  provider: 'gemini' | 'deterministic-fallback' = 'gemini'
): ReportResponsePayload {
  const fallback = provider === 'deterministic-fallback';
  return {
    schemaVersion: REPORT_RESPONSE_SCHEMA_VERSION,
    provider,
    reportMode: REPORT_BODY.reportMode,
    promptVersion: REPORT_BODY.promptVersion,
    report: {
      title: 'Contract fixture report',
      summary: {
        title: 'Contract fixture summary',
        analysis: ['Fixture analysis'],
        advice: ['Fixture advice']
      },
      sections: []
    },
    generationMeta: {
      schemaVersion: REPORT_GENERATION_META_SCHEMA_VERSION,
      provider,
      model: 'fixture-model',
      latencyMs: 9,
      attemptCount: 1,
      inputTokens: 100,
      outputTokens: 200,
      totalTokens: 300,
      estimatedCostMicros: 400,
      currency: 'USD',
      fallback,
      ...(fallback ? { fallbackReason: 'provider-unavailable' } : {}),
      cacheStatus: 'unknown',
      inputSchemaVersion: REPORT_REQUEST_SCHEMA_VERSION,
      responseSchemaVersion: REPORT_RESPONSE_SCHEMA_VERSION,
      engineVersion: 'fixture-engine-v1',
      adapterVersion: 'fixture-adapter-v1'
    }
  } as unknown as ReportResponsePayload;
}

function createLegacyPayload() {
  return {
    provider: 'gemini',
    reportMode: REPORT_BODY.reportMode,
    promptVersion: REPORT_BODY.promptVersion,
    report: {
      title: 'Legacy fixture report',
      summary: 'Legacy fixture summary',
      sections: []
    }
  };
}

function createLedger(overrides: Partial<ReportLedger> = {}): ReportLedger {
  return {
    documentId: 'fixture-ledger-document',
    path: '/fixtureLedgers/fixture-ledger-document',
    paymentId: CLAIMS.paymentId,
    orderId: CLAIMS.orderId,
    productId: CLAIMS.productId,
    amount: CLAIMS.amount,
    currency: 'KRW',
    storeId: 'fixture-store',
    transactionId: 'fixture-transaction',
    confirmedAt: REFERENCE_INSTANT,
    userId: 'fixture-user-id',
    userBinding: CLAIMS.userBinding,
    entitlementId: CLAIMS.entitlementId,
    orderClaimHash: 'fixture-order-claim-hash',
    entitlementStatus: 'active',
    entitlementCreatedAt: '2026-01-10T11:31:00.000Z',
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
    reportCacheSchemaVersion: '',
    reportInputSchemaVersion: '',
    reportResponseSchemaVersion: '',
    reportGenerationMetaSchemaVersion: '',
    createTime: '2026-01-10T11:29:00.000Z',
    updateTime: '2026-01-15T02:59:00.000Z',
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
  private conflictPayload: unknown = createLegacyPayload();
  private readonly preconditionConflict = new Error('fixture-precondition-conflict');
  private getError: unknown = null;

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

  private assertCurrentOwner(ledger: ReportLedger, lockId: string) {
    if (
      ledger.updateTime !== this.ledger.updateTime ||
      this.ledger.reportGenerationStatus !== 'generating' ||
      this.ledger.reportGenerationLockId !== lockId
    ) {
      throw this.preconditionConflict;
    }
  }

  setAcquireConflict(
    mode: Exclude<ConflictMode, 'none'>,
    payload: unknown = createLegacyPayload()
  ) {
    this.conflictMode = mode;
    this.conflictPayload = payload;
  }

  setGetError(error: unknown) {
    this.getError = error;
  }

  stealLease() {
    this.ledger = {
      ...this.ledger,
      updateTime: this.nextUpdateTime(),
      reportGenerationStatus: 'generating',
      reportGenerationLockId: 'foreign-lock',
      reportGenerationLockExpiresAt: new Date(FIXED_NOW + 60_000).toISOString()
    };
  }

  replaceCacheWithLegacy(payload: unknown = createLegacyPayload(), inputHash?: string) {
    const reportJson = JSON.stringify(payload);
    this.ledger = {
      ...this.ledger,
      reportInputHash: inputHash ?? this.ledger.reportInputHash,
      reportGenerationStatus: 'completed',
      reportGenerationLockId: '',
      reportGenerationLockExpiresAt: '',
      reportJson,
      reportJsonHash: createHash('sha256').update(reportJson).digest('hex'),
      reportCacheSchemaVersion: '',
      reportInputSchemaVersion: '',
      reportResponseSchemaVersion: '',
      reportGenerationMetaSchemaVersion: ''
    };
  }

  replaceCachePayload(payload: unknown) {
    const reportJson = JSON.stringify(payload);
    this.ledger = {
      ...this.ledger,
      reportJson,
      reportJsonHash: createHash('sha256').update(reportJson).digest('hex')
    };
  }

  tamperCacheHash() {
    this.ledger.reportJsonHash = '0'.repeat(64);
  }

  currentLedger() {
    return this.snapshot();
  }

  async get(paymentId: string) {
    this.getCalls.push(paymentId);
    if (this.getError) throw this.getError;
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
        reportGenerationLockId:
          this.conflictMode === 'generating' ? 'foreign-lock' : '',
        reportGenerationLockExpiresAt:
          this.conflictMode === 'generating'
            ? new Date(FIXED_NOW + 60_000).toISOString()
            : '',
        reportGenerationAttempt: input.attempt,
        reportJson: this.conflictMode === 'completed' ? reportJson : '',
        reportJsonHash:
          this.conflictMode === 'completed'
            ? createHash('sha256').update(reportJson).digest('hex')
            : '',
        reportCacheSchemaVersion: '',
        reportInputSchemaVersion: '',
        reportResponseSchemaVersion: '',
        reportGenerationMetaSchemaVersion: ''
      };
      throw this.preconditionConflict;
    }

    this.ledger = {
      ...this.ledger,
      updateTime: this.nextUpdateTime(),
      reportInputHash: input.inputHash,
      reportGenerationStatus: 'generating',
      reportGenerationLockId: input.lockId,
      reportGenerationLockExpiresAt: input.lockExpiresAt,
      reportGenerationStartedAt: input.startedAt,
      reportGenerationAttempt: input.attempt,
      reportGenerationCompletedAt: '',
      reportGenerationFailedAt: '',
      reportGenerationFailure: '',
      reportJson: '',
      reportJsonHash: '',
      reportCacheSchemaVersion: '',
      reportInputSchemaVersion: '',
      reportResponseSchemaVersion: '',
      reportGenerationMetaSchemaVersion: ''
    };
    return this.snapshot();
  }

  async completeReportGeneration(ledger: ReportLedger, input: CompleteInput) {
    this.completeCalls.push({ ...input });
    this.assertCurrentOwner(ledger, input.lockId);
    this.ledger = {
      ...this.ledger,
      updateTime: this.nextUpdateTime(),
      reportGenerationStatus: 'completed',
      reportGenerationLockId: '',
      reportGenerationLockExpiresAt: '',
      reportGenerationCompletedAt: input.completedAt,
      reportJson: input.reportJson,
      reportJsonHash: input.reportJsonHash,
      reportCacheSchemaVersion: input.cacheSchemaVersion,
      reportInputSchemaVersion: input.inputSchemaVersion,
      reportResponseSchemaVersion: input.responseSchemaVersion,
      reportGenerationMetaSchemaVersion: input.generationMetaSchemaVersion
    };
    return this.snapshot();
  }

  async failReportGeneration(ledger: ReportLedger, input: FailInput) {
    this.failCalls.push({ ...input });
    this.assertCurrentOwner(ledger, input.lockId);
    this.ledger = {
      ...this.ledger,
      updateTime: this.nextUpdateTime(),
      reportGenerationStatus: 'failed',
      reportGenerationLockId: '',
      reportGenerationLockExpiresAt: '',
      reportGenerationFailedAt: input.failedAt,
      reportGenerationFailure: input.failure,
      reportJson: '',
      reportJsonHash: '',
      reportCacheSchemaVersion: '',
      reportInputSchemaVersion: '',
      reportResponseSchemaVersion: '',
      reportGenerationMetaSchemaVersion: ''
    };
    return this.snapshot();
  }

  isPreconditionConflict(error: unknown) {
    return error === this.preconditionConflict;
  }
}

const config = loadConfig({
  NODE_ENV: 'test',
  GEMINI_MODEL: 'fixture-config-model',
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

  it('acquires and completes once, then serves identical normalized input from cache', async () => {
    const repository = new FakeReportLedgerRepository();
    const generator = vi.fn(async () => createPayload());
    const service = new ReportService(config, repository, generator);

    const first = await service.generate(CLAIMS, REPORT_BODY);
    const second = await service.generate(CLAIMS, REPORT_BODY);

    expect(first.generationMeta.cacheStatus).toBe('miss');
    expect(second.generationMeta.cacheStatus).toBe('hit');
    expect(first.report).toEqual(second.report);
    expect(generator).toHaveBeenCalledTimes(1);
    expect(generator).toHaveBeenCalledWith(REPORT_BODY, {
      referenceInstant: REFERENCE_INSTANT,
      deadlineInstant: new Date(FIXED_NOW + 115_000).toISOString(),
      signal: expect.any(AbortSignal)
    });
    expect(repository.acquireCalls).toHaveLength(1);
    expect(repository.completeCalls).toHaveLength(1);
    expect(repository.failCalls).toHaveLength(0);
    expect(repository.currentLedger()).toMatchObject({
      reportGenerationStatus: 'completed',
      reportGenerationAttempt: 1,
      reportCacheSchemaVersion: REPORT_CACHE_SCHEMA_VERSION,
      reportInputSchemaVersion: REPORT_REQUEST_SCHEMA_VERSION,
      reportResponseSchemaVersion: REPORT_RESPONSE_SCHEMA_VERSION,
      reportGenerationMetaSchemaVersion: REPORT_GENERATION_META_SCHEMA_VERSION
    });
  });

  it('preserves provider latency and retry metrics separately from the lease attempt', async () => {
    const repository = new FakeReportLedgerRepository();
    const base = createPayload();
    const rawPayload: ReportResponsePayload = {
      ...base,
      generationMeta: {
        ...base.generationMeta,
        latencyMs: 987,
        attemptCount: 2
      }
    };
    const service = new ReportService(
      config,
      repository,
      vi.fn(async () => rawPayload)
    );

    const result = await service.generate(CLAIMS, REPORT_BODY);

    expect(repository.acquireCalls[0].attempt).toBe(1);
    expect(result.generationMeta).toMatchObject({ latencyMs: 987, attemptCount: 2 });
  });

  it('canonicalizes normalized optional undefined fields without rejecting a valid request', async () => {
    const repository = new FakeReportLedgerRepository();
    const generator = vi.fn(async () => createPayload());
    const service = new ReportService(config, repository, generator);
    const requestWithLocation: NormalizedReportRequest = {
      ...REPORT_BODY,
      payload: {
        ...REPORT_BODY.payload,
        birth: {
          ...REPORT_BODY.payload.birth,
          location: {
            label: 'Seoul',
            latitude: undefined,
            longitude: undefined,
            timezone: undefined,
            utcOffsetMinutes: undefined,
            applySolarTimeCorrection: undefined
          }
        }
      }
    };

    await expect(service.generate(CLAIMS, requestWithLocation)).resolves.toMatchObject({
      generationMeta: { cacheStatus: 'miss' }
    });
    expect(generator).toHaveBeenCalledTimes(1);
  });

  it('maps repository I/O failures to the privacy-safe storage error contract', async () => {
    const repository = new FakeReportLedgerRepository();
    repository.setGetError(new Error('fixture-sensitive-storage-detail'));
    const generator = vi.fn(async () => createPayload());
    const service = new ReportService(config, repository, generator);

    await expect(service.generate(CLAIMS, REPORT_BODY)).rejects.toMatchObject({
      status: 503,
      code: 'REPORT_STORAGE_UNAVAILABLE',
      retryable: true,
      message: 'Report storage is temporarily unavailable.'
    });
    expect(generator).not.toHaveBeenCalled();
  });
  it('rejects the same entitlement when normalized user input changes', async () => {
    const repository = new FakeReportLedgerRepository();
    const generator = vi.fn(async () => createPayload());
    const service = new ReportService(config, repository, generator);
    await service.generate(CLAIMS, REPORT_BODY);

    const changedInput: NormalizedReportRequest = {
      ...REPORT_BODY,
      payload: {
        ...REPORT_BODY.payload,
        questions: ['A different normalized question']
      }
    };

    await expect(service.generate(CLAIMS, changedInput)).rejects.toMatchObject({
      status: 409,
      code: 'REPORT_INPUT_CONFLICT',
      retryable: false
    });
    expect(generator).toHaveBeenCalledTimes(1);
  });

  it('reports a well-formed future generation lease as an in-progress retry', async () => {
    const repository = new FakeReportLedgerRepository(
      createLedger({
        reportGenerationStatus: 'generating',
        reportGenerationLockId: 'active-lock',
        reportGenerationLockExpiresAt: new Date(FIXED_NOW + 60_000).toISOString(),
        reportGenerationAttempt: 1
      })
    );
    const generator = vi.fn(async () => createPayload());
    const service = new ReportService(config, repository, generator);

    const error = await service.generate(CLAIMS, REPORT_BODY).catch((caught) => caught);

    expect(error).toBeInstanceOf(ReportGenerationInProgressError);
    expect(error).toMatchObject({
      status: 409,
      code: 'REPORT_GENERATION_IN_PROGRESS',
      retryable: true,
      retryAfterSeconds: 3
    });
    expect(generator).not.toHaveBeenCalled();
    expect(repository.acquireCalls).toHaveLength(0);
  });

  it.each([
    ['expired', FIXED_NOW - 1],
    ['exact boundary', FIXED_NOW]
  ])('reacquires a lease at the %s instant', async (_label, expiresAt) => {
    const repository = new FakeReportLedgerRepository(
      createLedger({
        reportGenerationStatus: 'generating',
        reportGenerationLockId: 'expired-lock',
        reportGenerationLockExpiresAt: new Date(expiresAt).toISOString(),
        reportGenerationAttempt: 2
      })
    );
    const generator = vi.fn(async () => createPayload());
    const service = new ReportService(config, repository, generator);

    await expect(service.generate(CLAIMS, REPORT_BODY)).resolves.toMatchObject({
      generationMeta: { cacheStatus: 'miss' }
    });
    expect(repository.acquireCalls[0].attempt).toBe(3);
    expect(generator).toHaveBeenCalledTimes(1);
  });

  it('rejects a malformed generating lease instead of guessing ownership', async () => {
    const repository = new FakeReportLedgerRepository(
      createLedger({
        reportGenerationStatus: 'generating',
        reportGenerationLockId: 'malformed-lock',
        reportGenerationLockExpiresAt: 'not-an-instant',
        reportGenerationAttempt: 1
      })
    );
    const service = new ReportService(config, repository, vi.fn(async () => createPayload()));

    await expect(service.generate(CLAIMS, REPORT_BODY)).rejects.toMatchObject({
      status: 503,
      code: 'REPORT_LEASE_INVALID',
      retryable: true
    });
    expect(repository.acquireCalls).toHaveLength(0);
  });

  it('aborts provider work and releases the lease before its completion reserve', async () => {
    const shortConfig = loadConfig({
      NODE_ENV: 'test',
      REPORT_GENERATION_LOCK_TTL_MS: '60000'
    });
    const repository = new FakeReportLedgerRepository();
    let receivedSignal: AbortSignal | undefined;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const generator = vi.fn(
      (_body: NormalizedReportRequest, context?: ReportGenerationContext) =>
        new Promise<never>((_resolve, reject) => {
          receivedSignal = context?.signal;
          markStarted();
          if (!receivedSignal) {
            reject(new Error('fixture generation signal is missing'));
            return;
          }
          receivedSignal.addEventListener(
            'abort',
            () => reject(receivedSignal?.reason),
            { once: true }
          );
        })
    );
    const service = new ReportService(shortConfig, repository, generator);
    const pending = service.generate(CLAIMS, REPORT_BODY);
    const rejection = expect(pending).rejects.toMatchObject({
      status: 504,
      code: 'REPORT_TIMEOUT',
      retryable: true
    });

    await started;
    await vi.advanceTimersByTimeAsync(55_000);

    await rejection;
    expect(receivedSignal?.aborted).toBe(true);
    expect(repository.failCalls).toHaveLength(1);
    expect(repository.currentLedger().reportGenerationStatus).toBe('failed');
    expect(Date.now()).toBe(FIXED_NOW + 55_000);
  });

  it('persists deterministic fallback once and reuses it for identical input', async () => {
    const repository = new FakeReportLedgerRepository();
    const generator = vi.fn(async () => createPayload('deterministic-fallback'));
    const service = new ReportService(config, repository, generator);

    const first = await service.generate(CLAIMS, REPORT_BODY);
    const second = await service.generate(CLAIMS, REPORT_BODY);

    expect(first).toMatchObject({
      provider: 'deterministic-fallback',
      generationMeta: { fallback: true, cacheStatus: 'miss' }
    });
    expect(second).toMatchObject({
      provider: 'deterministic-fallback',
      generationMeta: { fallback: true, cacheStatus: 'hit' }
    });
    expect(generator).toHaveBeenCalledTimes(1);
    expect(repository.completeCalls).toHaveLength(1);
    expect(repository.failCalls).toHaveLength(0);
  });

  it('accepts the exact v1 input hash and upgrades a complete legacy cache in memory', async () => {
    const repository = new FakeReportLedgerRepository();
    const generator = vi.fn(async () => createPayload());
    const service = new ReportService(config, repository, generator);
    await service.generate(CLAIMS, REPORT_BODY);
    repository.replaceCacheWithLegacy(createLegacyPayload(), legacyInputHash(REPORT_BODY));

    const cached = await service.generate(CLAIMS, REPORT_BODY);

    expect(cached).toMatchObject({
      schemaVersion: REPORT_RESPONSE_SCHEMA_VERSION,
      provider: 'gemini',
      generationMeta: {
        schemaVersion: REPORT_GENERATION_META_SCHEMA_VERSION,
        cacheStatus: 'hit',
        inputSchemaVersion: REPORT_REQUEST_SCHEMA_VERSION,
        responseSchemaVersion: REPORT_RESPONSE_SCHEMA_VERSION
      }
    });
    expect(generator).toHaveBeenCalledTimes(1);
  });

  it('rejects changed input even when the completed cache uses a v1 input hash', async () => {
    const repository = new FakeReportLedgerRepository();
    const generator = vi.fn(async () => createPayload());
    const service = new ReportService(config, repository, generator);
    await service.generate(CLAIMS, REPORT_BODY);
    repository.replaceCacheWithLegacy(createLegacyPayload(), legacyInputHash(REPORT_BODY));
    const changedInput: NormalizedReportRequest = {
      ...REPORT_BODY,
      payload: {
        ...REPORT_BODY.payload,
        questions: ['Changed after legacy cache creation']
      }
    };

    await expect(service.generate(CLAIMS, changedInput)).rejects.toMatchObject({
      status: 409,
      code: 'REPORT_INPUT_CONFLICT',
      retryable: false
    });
    expect(generator).toHaveBeenCalledTimes(1);
    expect(repository.acquireCalls).toHaveLength(1);
  });

  it('returns a completed cache after an acquire precondition conflict', async () => {
    const repository = new FakeReportLedgerRepository();
    repository.setAcquireConflict('completed');
    const generator = vi.fn(async () => createPayload());
    const service = new ReportService(config, repository, generator);

    await expect(service.generate(CLAIMS, REPORT_BODY)).resolves.toMatchObject({
      generationMeta: { cacheStatus: 'hit' }
    });
    expect(repository.getCalls).toHaveLength(2);
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
    expect(generator).not.toHaveBeenCalled();
  });

  it('rejects both completion and release after another worker steals the lease', async () => {
    const repository = new FakeReportLedgerRepository();
    const generator = vi.fn(async () => {
      repository.stealLease();
      return createPayload();
    });
    const service = new ReportService(config, repository, generator);

    await expect(service.generate(CLAIMS, REPORT_BODY)).rejects.toMatchObject({
      status: 409,
      code: 'REPORT_LEASE_LOST',
      retryable: true
    });
    expect(repository.completeCalls).toHaveLength(1);
    expect(repository.failCalls).toHaveLength(1);
    expect(repository.currentLedger()).toMatchObject({
      reportGenerationStatus: 'generating',
      reportGenerationLockId: 'foreign-lock'
    });
  });

  it('releases its owned lease when generation fails', async () => {
    const repository = new FakeReportLedgerRepository();
    const generator = vi.fn(async () => {
      throw new Error('fixture-provider-failure');
    });
    const service = new ReportService(config, repository, generator);

    await expect(service.generate(CLAIMS, REPORT_BODY)).rejects.toThrow(
      'fixture-provider-failure'
    );
    expect(repository.failCalls).toHaveLength(1);
    expect(repository.currentLedger()).toMatchObject({
      reportGenerationStatus: 'failed',
      reportGenerationLockId: '',
      reportJson: '',
      reportJsonHash: ''
    });
  });

  it('emits only the privacy-safe telemetry allowlist', async () => {
    const repository = new FakeReportLedgerRepository();
    const events: ReportGenerationTelemetryEvent[] = [];
    const service = new ReportService(
      config,
      repository,
      vi.fn(async () => createPayload()),
      { telemetry: (event) => { events.push(event); } }
    );

    await service.generate(CLAIMS, REPORT_BODY);

    expect(events).toHaveLength(1);
    expect(
      Object.keys(events[0]).every((key) =>
        (REPORT_TELEMETRY_KEYS as readonly string[]).includes(key)
      )
    ).toBe(true);
    expect(events[0]).toMatchObject({
      productId: 'general-signature',
      provider: 'gemini',
      model: 'fixture-model',
      cacheStatus: 'miss',
      fallback: false
    });
    const serialized = JSON.stringify(events[0]);
    for (const sensitive of [
      CLAIMS.paymentId,
      CLAIMS.orderId,
      CLAIMS.userBinding,
      CLAIMS.entitlementId,
      REPORT_BODY.payload.user.name,
      REPORT_BODY.payload.questions[0]
    ]) {
      expect(serialized).not.toContain(sensitive);
    }
  });

  it('bounds a stuck telemetry sink without changing report delivery', async () => {
    const repository = new FakeReportLedgerRepository();
    const telemetry = vi.fn(() => new Promise<void>(() => undefined));
    const service = new ReportService(
      config,
      repository,
      vi.fn(async () => createPayload()),
      { telemetry }
    );

    const generated = service.generate(CLAIMS, REPORT_BODY);
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(generated).resolves.toMatchObject({
      generationMeta: { cacheStatus: 'miss' }
    });
    expect(telemetry).toHaveBeenCalledTimes(1);
    expect(repository.currentLedger()).toMatchObject({
      reportGenerationStatus: 'completed'
    });
  });

  it('rejects a legacy payload that claims current cache version metadata', async () => {
    const repository = new FakeReportLedgerRepository();
    const generator = vi.fn(async () => createPayload());
    const service = new ReportService(config, repository, generator);
    await service.generate(CLAIMS, REPORT_BODY);
    repository.replaceCachePayload(createLegacyPayload());

    await expect(service.generate(CLAIMS, REPORT_BODY)).rejects.toMatchObject({
      status: 503,
      code: 'REPORT_CACHE_INTEGRITY_FAILED',
      retryable: true
    });
    expect(generator).toHaveBeenCalledTimes(1);
  });

  it('rejects a completed cache whose integrity hash was tampered with', async () => {
    const repository = new FakeReportLedgerRepository();
    const generator = vi.fn(async () => createPayload());
    const service = new ReportService(config, repository, generator);
    await service.generate(CLAIMS, REPORT_BODY);
    repository.tamperCacheHash();

    await expect(service.generate(CLAIMS, REPORT_BODY)).rejects.toMatchObject({
      status: 503,
      code: 'REPORT_CACHE_INTEGRITY_FAILED',
      retryable: true
    });
    expect(generator).toHaveBeenCalledTimes(1);
  });
});
