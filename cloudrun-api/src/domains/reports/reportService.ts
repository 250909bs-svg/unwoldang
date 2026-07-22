import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { AppConfig } from '../../config/env.ts';
import type { ReportAccessClaims } from '../../contracts/auth.ts';
import {
  REPORT_ERROR_CODE,
  ReportGenerationInProgressError,
  ReportPlatformError,
  ReportRequestError
} from '../../contracts/errors.ts';
import type { PaymentLedger } from '../../repositories/paymentLedgerRepository.ts';
import {
  REPORT_GENERATION_META_SCHEMA_VERSION,
  REPORT_REQUEST_SCHEMA_VERSION,
  REPORT_RESPONSE_SCHEMA_VERSION,
  isReportErrorCode,
  type ReportErrorCode,
  type ReportGenerationMetaV1,
  type ReportRequestV1,
  type ReportResponseV1
} from '../../../../src/features/reports/contracts.ts';
import {
  REPORT_CACHE_SCHEMA_VERSION,
  REPORT_CACHE_VERSION_FIELDS,
  normalizeGeneratedReport,
  parseCachedReport
} from './reportPayload.ts';
import {
  createPrivacySafeReportTelemetryEvent,
  noopReportTelemetry,
  type ReportTelemetrySink
} from './telemetry.ts';

export type ReportResponsePayload = ReportResponseV1;
export type NormalizedReportRequest = Omit<ReportRequestV1, 'orderId'>;
export type ReportLedger = PaymentLedger;

export type ReportLedgerRepository = {
  get(paymentId: string): Promise<ReportLedger>;
  acquireReportGeneration(
    ledger: ReportLedger,
    input: {
      inputHash: string;
      lockId: string;
      lockExpiresAt: string;
      startedAt: string;
      attempt: number;
    }
  ): Promise<ReportLedger>;
  completeReportGeneration(
    ledger: ReportLedger,
    input: {
      lockId: string;
      completedAt: string;
      reportJson: string;
      reportJsonHash: string;
      cacheSchemaVersion: string;
      inputSchemaVersion: string;
      responseSchemaVersion: string;
      generationMetaSchemaVersion: string;
    }
  ): Promise<ReportLedger>;
  failReportGeneration(
    ledger: ReportLedger,
    input: { lockId: string; failedAt: string; failure: string }
  ): Promise<ReportLedger>;
  isPreconditionConflict(error: unknown): boolean;
};

export type ReportGenerationContext = {
  referenceInstant: string;
  deadlineInstant: string;
};

type ReportGenerator = (
  body: NormalizedReportRequest,
  context?: ReportGenerationContext
) => Promise<unknown>;

export type ReportServiceOptions = {
  telemetry?: ReportTelemetrySink;
};

type ReportGenerationLease = {
  kind: 'acquired';
  inputHash: string;
  inputHashes: ReportInputHashes;
  ledger: ReportLedger;
  lockId: string;
  lockExpiresAt: string;
  attempt: number;
  referenceInstant: string;
};

type ReportInputHashes = {
  current: string;
  legacy: string;
};

type ReportGenerationResult =
  | ReportGenerationLease
  | {
      kind: 'cached';
      payload: ReportResponsePayload;
    };

const REPORT_COMPLETION_MARGIN_MS = 5_000;
const REPORT_TELEMETRY_TIMEOUT_MS = 1_000;

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function canonicalJson(value: unknown): string {
  if (value === null) return 'null';

  if (typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new ReportPlatformError({
        status: 400,
        code: REPORT_ERROR_CODE.INVALID_REQUEST,
        message: 'Report request contains a non-finite number.',
        retryable: false
      });
    }
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const keys = Object.keys(source)
      .filter((key) => source[key] !== undefined)
      .sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(source[key])}`)
      .join(',')}}`;
  }

  throw new ReportPlatformError({
    status: 400,
    code: REPORT_ERROR_CODE.INVALID_REQUEST,
    message: 'Report request contains an unsupported value.',
    retryable: false
  });
}

function stableReferenceInstant(ledger: ReportLedger) {
  for (const value of [ledger.confirmedAt, ledger.entitlementCreatedAt]) {
    const instant = Date.parse(value);
    if (Number.isFinite(instant)) return new Date(instant).toISOString();
  }

  throw new ReportPlatformError({
    status: 503,
    code: REPORT_ERROR_CODE.LEASE_INVALID,
    message: 'The report entitlement has no stable reference instant.',
    retryable: false
  });
}

function publicErrorCode(error: unknown): ReportErrorCode {
  const code =
    error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
  return isReportErrorCode(code) ? code : 'REPORT_UNKNOWN_ERROR';
}

export class ReportService {
  private readonly telemetry: ReportTelemetrySink;

  constructor(
    private readonly config: AppConfig,
    private readonly ledgerRepository: ReportLedgerRepository,
    private readonly generateReport: ReportGenerator,
    options: ReportServiceOptions = {}
  ) {
    this.telemetry = options.telemetry || noopReportTelemetry;
  }

  private async emitTelemetry(productId: string, generationMeta: ReportGenerationMetaV1) {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const event = createPrivacySafeReportTelemetryEvent({ productId, generationMeta });
      await Promise.race([
        Promise.resolve().then(() => this.telemetry(event)),
        new Promise<void>((resolve) => {
          timeoutId = setTimeout(resolve, REPORT_TELEMETRY_TIMEOUT_MS);
        })
      ]);
    } catch {
      // Observability must never change report delivery semantics.
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    }
  }

  private failureMeta(
    error: unknown,
    latencyMs: number,
    attemptCount: number
  ): ReportGenerationMetaV1 {
    return {
      schemaVersion: REPORT_GENERATION_META_SCHEMA_VERSION,
      provider: 'unknown',
      model: this.config.gemini.model || null,
      latencyMs,
      attemptCount,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      estimatedCostMicros: null,
      currency: 'USD',
      fallback: false,
      cacheStatus: 'unknown',
      errorCode: publicErrorCode(error),
      inputSchemaVersion: REPORT_REQUEST_SCHEMA_VERSION,
      responseSchemaVersion: REPORT_RESPONSE_SCHEMA_VERSION
    };
  }

  private getInputHashes(
    claims: ReportAccessClaims,
    reportBody: NormalizedReportRequest
  ): ReportInputHashes {
    const currentInput = canonicalJson({
      version: 'unwoldang-report-input-v2',
      schemaVersion: REPORT_REQUEST_SCHEMA_VERSION,
      entitlementId: claims.entitlementId,
      paymentId: claims.paymentId,
      orderId: claims.orderId,
      productId: claims.productId,
      amount: claims.amount,
      request: reportBody
    });

    const { schemaVersion: _schemaVersion, ...legacyRequest } = reportBody;
    void _schemaVersion;
    const legacyInput = canonicalJson({
      version: 'unwoldang-report-input-v1',
      paymentId: claims.paymentId,
      orderId: claims.orderId,
      productId: claims.productId,
      amount: claims.amount,
      request: legacyRequest
    });

    return {
      current: createHash('sha256').update(currentInput).digest('hex'),
      legacy: createHash('sha256').update(legacyInput).digest('hex')
    };
  }

  private assertLedgerMatchesClaims(ledger: ReportLedger, claims: ReportAccessClaims) {
    if (
      ledger.paymentId !== claims.paymentId ||
      ledger.orderId !== claims.orderId ||
      ledger.productId !== claims.productId ||
      ledger.amount !== claims.amount ||
      ledger.userBinding !== claims.userBinding ||
      ledger.entitlementId !== claims.entitlementId ||
      ledger.entitlementStatus !== 'active'
    ) {
      throw new ReportPlatformError({
        status: 403,
        code: REPORT_ERROR_CODE.ACCESS_MISMATCH,
        message: 'Report token does not match the confirmed payment ledger.',
        retryable: false
      });
    }
  }

  private isLegacyCacheMetadata(ledger: ReportLedger) {
    return [
      ledger.reportCacheSchemaVersion,
      ledger.reportInputSchemaVersion,
      ledger.reportResponseSchemaVersion,
      ledger.reportGenerationMetaSchemaVersion
    ].every((value) => !value);
  }

  private assertCompatibleInput(ledger: ReportLedger, inputHashes: ReportInputHashes) {
    if (!ledger.reportInputHash || ledger.reportInputHash === inputHashes.current) {
      return inputHashes.current;
    }
    if (
      this.isLegacyCacheMetadata(ledger) &&
      ledger.reportInputHash === inputHashes.legacy
    ) {
      return inputHashes.legacy;
    }

    throw new ReportPlatformError({
      status: 409,
      code: REPORT_ERROR_CODE.ENTITLEMENT_INPUT_CONFLICT,
      message: 'This payment has already been bound to a different report input.',
      retryable: false
    });
  }

  private parseCompletedReport(
    ledger: ReportLedger,
    inputHashes: ReportInputHashes
  ): ReportResponsePayload | null {
    if (ledger.reportGenerationStatus !== 'completed') return null;

    const compatibleHash = this.assertCompatibleInput(ledger, inputHashes);
    if (ledger.reportInputHash !== compatibleHash) {
      throw new ReportPlatformError({
        status: 409,
        code: REPORT_ERROR_CODE.ENTITLEMENT_INPUT_CONFLICT,
        message: 'This payment has already been used for a different report input.',
        retryable: false
      });
    }

    const isLegacyCache = this.isLegacyCacheMetadata(ledger);
    if (
      !isLegacyCache &&
      (ledger.reportCacheSchemaVersion !== REPORT_CACHE_SCHEMA_VERSION ||
        ledger.reportInputSchemaVersion !== REPORT_REQUEST_SCHEMA_VERSION ||
        ledger.reportResponseSchemaVersion !== REPORT_RESPONSE_SCHEMA_VERSION ||
        ledger.reportGenerationMetaSchemaVersion !== REPORT_GENERATION_META_SCHEMA_VERSION)
    ) {
      throw new ReportPlatformError({
        status: 503,
        code: REPORT_ERROR_CODE.CACHE_INVALID,
        message: 'The saved report cache uses an unsupported schema version.',
        retryable: true
      });
    }

    const reportJson = ledger.reportJson;
    if (!reportJson || Buffer.byteLength(reportJson, 'utf8') > this.config.report.cacheMaxBytes) {
      throw new ReportPlatformError({
        status: 503,
        code: REPORT_ERROR_CODE.CACHE_INVALID,
        message: 'The saved report cache is unavailable or exceeds its safety limit.',
        retryable: true
      });
    }

    const actualHash = createHash('sha256').update(reportJson).digest('hex');
    if (!/^[a-f0-9]{64}$/.test(ledger.reportJsonHash) || !safeEqual(ledger.reportJsonHash, actualHash)) {
      throw new ReportPlatformError({
        status: 503,
        code: REPORT_ERROR_CODE.CACHE_INVALID,
        message: 'The saved report cache failed its integrity check.',
        retryable: true
      });
    }

    try {
      return parseCachedReport(JSON.parse(reportJson) as unknown, {
        allowLegacy: isLegacyCache
      });
    } catch (error) {
      if (error instanceof ReportPlatformError) throw error;
      throw new ReportPlatformError({
        status: 503,
        code: REPORT_ERROR_CODE.CACHE_INVALID,
        message: 'The saved report cache could not be decoded.',
        retryable: true,
        cause: error
      });
    }
  }

  private async readLedger(claims: ReportAccessClaims) {
    try {
      const ledger = await this.ledgerRepository.get(claims.paymentId);
      this.assertLedgerMatchesClaims(ledger, claims);
      return ledger;
    } catch (error) {
      if (error instanceof ReportRequestError && error.status === 404) {
        throw new ReportPlatformError({
          status: 403,
          code: REPORT_ERROR_CODE.ACCESS_MISMATCH,
          message: 'Confirmed payment ledger was not found for this report token.',
          retryable: false,
          cause: error
        });
      }
      throw this.storageUnavailable(error);
    }
  }

  private readLeaseExpiry(ledger: ReportLedger) {
    const expiresAt = Date.parse(ledger.reportGenerationLockExpiresAt);
    if (!ledger.reportGenerationLockId || !Number.isFinite(expiresAt) ||
      !Number.isSafeInteger(ledger.reportGenerationAttempt) || ledger.reportGenerationAttempt < 1) {
      throw new ReportPlatformError({
        status: 503,
        code: REPORT_ERROR_CODE.LEASE_INVALID,
        message: 'The payment ledger contains a malformed report generation lease.',
        retryable: true
      });
    }
    return expiresAt;
  }

  private leaseLost(cause?: unknown) {
    return new ReportPlatformError({
      status: 409,
      code: REPORT_ERROR_CODE.LEASE_LOST,
      message: 'The report generation lease is no longer owned by this request.',
      retryable: true,
      cause
    });
  }

  private storageUnavailable(cause: unknown) {
    return cause instanceof ReportPlatformError
      ? cause
      : new ReportPlatformError({
          status: 503,
          code: REPORT_ERROR_CODE.STORAGE_UNAVAILABLE,
          message: 'Report storage is temporarily unavailable.',
          retryable: true,
          cause
        });
  }

  private async resolveContention(
    claims: ReportAccessClaims,
    inputHashes: ReportInputHashes
  ): Promise<ReportGenerationResult> {
    const current = await this.readLedger(claims);
    this.assertCompatibleInput(current, inputHashes);
    const cached = this.parseCompletedReport(current, inputHashes);
    if (cached) return { kind: 'cached', payload: cached };

    if (current.reportGenerationStatus === 'generating') {
      if (this.readLeaseExpiry(current) <= Date.now()) throw this.leaseLost();
      throw new ReportGenerationInProgressError();
    }
    throw this.leaseLost();
  }

  private async acquire(
    claims: ReportAccessClaims,
    reportBody: NormalizedReportRequest
  ): Promise<ReportGenerationResult> {
    const inputHashes = this.getInputHashes(claims, reportBody);
    const inputHash = inputHashes.current;
    const ledger = await this.readLedger(claims);
    this.assertCompatibleInput(ledger, inputHashes);
    const cached = this.parseCompletedReport(ledger, inputHashes);
    if (cached) return { kind: 'cached', payload: cached };

    const status = ledger.reportGenerationStatus;
    const now = Date.now();
    if (status === 'generating' && this.readLeaseExpiry(ledger) > now) {
      throw new ReportGenerationInProgressError();
    }
    if (status && status !== 'generating' && status !== 'failed') {
      throw new ReportPlatformError({
        status: 503,
        code: REPORT_ERROR_CODE.LEASE_INVALID,
        message: 'The payment ledger contains an invalid report generation state.',
        retryable: true
      });
    }
    if (!ledger.updateTime) {
      throw new ReportPlatformError({
        status: 503,
        code: REPORT_ERROR_CODE.LEASE_INVALID,
        message: 'The payment ledger does not expose a concurrency version.',
        retryable: true
      });
    }

    const previousAttempt = ledger.reportGenerationAttempt;
    const attempt = Number.isSafeInteger(previousAttempt) && previousAttempt >= 0
      ? previousAttempt + 1 : 1;
    const lockId = randomBytes(18).toString('base64url');
    const lockExpiresAt = new Date(now + this.config.report.generationLockTtlMs).toISOString();
    const referenceInstant = stableReferenceInstant(ledger);

    try {
      const acquired = await this.ledgerRepository.acquireReportGeneration(ledger, {
        inputHash, lockId, lockExpiresAt, startedAt: new Date(now).toISOString(), attempt
      });
      this.assertLedgerMatchesClaims(acquired, claims);
      const acquiredExpiry = Date.parse(acquired.reportGenerationLockExpiresAt);
      if (!acquired.updateTime || acquired.updateTime === ledger.updateTime ||
        acquired.reportGenerationStatus !== 'generating' || acquired.reportInputHash !== inputHash ||
        acquired.reportGenerationLockId !== lockId || acquired.reportGenerationAttempt !== attempt ||
        !Number.isFinite(acquiredExpiry) || acquiredExpiry !== Date.parse(lockExpiresAt) ||
        acquiredExpiry <= now || acquired.reportJson || acquired.reportJsonHash) {
        throw new ReportPlatformError({
          status: 503,
          code: REPORT_ERROR_CODE.LEASE_INVALID,
          message: 'The acquired report generation lease failed validation.',
          retryable: true
        });
      }
      return { kind: 'acquired', inputHash, inputHashes, ledger: acquired, lockId, lockExpiresAt,
        attempt, referenceInstant };
    } catch (error) {
      if (this.ledgerRepository.isPreconditionConflict(error)) {
        return this.resolveContention(claims, inputHashes);
      }
      throw this.storageUnavailable(error);
    }
  }

  private async complete(
    claims: ReportAccessClaims,
    lease: ReportGenerationLease,
    payload: ReportResponsePayload
  ) {
    if (Date.parse(lease.lockExpiresAt) <= Date.now()) {
      throw this.leaseLost();
    }
    const reportJson = JSON.stringify(payload);
    if (!reportJson || Buffer.byteLength(reportJson, 'utf8') > this.config.report.cacheMaxBytes) {
      throw new ReportPlatformError({
        status: 413,
        code: REPORT_ERROR_CODE.RESPONSE_INVALID,
        message: 'Generated report exceeds the persistence safety limit.',
        retryable: false
      });
    }
    const reportJsonHash = createHash('sha256').update(reportJson).digest('hex');

    try {
      const completed = await this.ledgerRepository.completeReportGeneration(lease.ledger, {
        lockId: lease.lockId,
        completedAt: new Date().toISOString(),
        reportJson,
        reportJsonHash,
        ...REPORT_CACHE_VERSION_FIELDS
      });
      this.assertLedgerMatchesClaims(completed, claims);
      if (!completed.updateTime || completed.updateTime === lease.ledger.updateTime ||
        completed.reportGenerationStatus !== 'completed' || completed.reportInputHash !== lease.inputHash ||
        completed.reportGenerationLockId || completed.reportGenerationLockExpiresAt ||
        completed.reportJson !== reportJson || completed.reportJsonHash !== reportJsonHash ||
        completed.reportCacheSchemaVersion !== REPORT_CACHE_SCHEMA_VERSION ||
        completed.reportInputSchemaVersion !== REPORT_REQUEST_SCHEMA_VERSION ||
        completed.reportResponseSchemaVersion !== REPORT_RESPONSE_SCHEMA_VERSION ||
        completed.reportGenerationMetaSchemaVersion !== REPORT_GENERATION_META_SCHEMA_VERSION) {
        throw this.leaseLost();
      }
      return payload;
    } catch (writeError) {
      try {
        const current = await this.readLedger(claims);
        this.assertCompatibleInput(current, lease.inputHashes);
        const cached = this.parseCompletedReport(current, lease.inputHashes);
        if (cached) return cached;
      } catch {
        // Preserve the original storage or CAS result below.
      }
      if (this.ledgerRepository.isPreconditionConflict(writeError)) throw this.leaseLost(writeError);
      throw this.storageUnavailable(writeError);
    }
  }

  private async fail(lease: ReportGenerationLease, error: unknown) {
    const failure = error instanceof ReportRequestError
      ? `${error.name}:${error.status}`
      : error instanceof Error ? error.name.slice(0, 120) : 'UnknownError';

    try {
      const failed = await this.ledgerRepository.failReportGeneration(lease.ledger, {
        lockId: lease.lockId, failedAt: new Date().toISOString(), failure
      });
      if (!failed.updateTime || failed.updateTime === lease.ledger.updateTime ||
        failed.reportGenerationStatus !== 'failed' || failed.reportInputHash !== lease.inputHash ||
        failed.reportGenerationLockId || failed.reportJson || failed.reportJsonHash ||
        failed.reportCacheSchemaVersion || failed.reportInputSchemaVersion ||
        failed.reportResponseSchemaVersion || failed.reportGenerationMetaSchemaVersion) {
        throw new ReportPlatformError({
          status: 503,
          code: REPORT_ERROR_CODE.LEASE_INVALID,
          message: 'The report generation lease was not released cleanly.',
          retryable: true
        });
      }
    } catch (recoveryError) {
      if (this.ledgerRepository.isPreconditionConflict(recoveryError)) {
        throw this.leaseLost(recoveryError);
      }
      throw this.storageUnavailable(recoveryError);
    }
  }

  private async generatePaid(claims: ReportAccessClaims, reportBody: NormalizedReportRequest) {
    const operationStartedAt = Date.now();
    let lease: ReportGenerationLease | null = null;
    let attemptCount = 0;
    try {
      const generation = await this.acquire(claims, reportBody);
      if (generation.kind === 'cached') {
        await this.emitTelemetry(claims.productId, generation.payload.generationMeta);
        return generation.payload;
      }
      lease = generation;
      attemptCount = generation.attempt;
      const generatorStartedAt = Date.now();
      const rawPayload = await this.generateReport(reportBody, {
        referenceInstant: generation.referenceInstant,
        deadlineInstant: new Date(Date.parse(generation.lockExpiresAt) - REPORT_COMPLETION_MARGIN_MS).toISOString()
      });
      const payload = normalizeGeneratedReport(rawPayload, {
        model: this.config.gemini.model || null,
        latencyMs: Math.max(0, Date.now() - generatorStartedAt),
        attemptCount,
        cacheStatus: 'miss',
        reportMode: reportBody.reportMode,
        promptVersion: reportBody.promptVersion
      });
      const completed = await this.complete(claims, generation, payload);
      await this.emitTelemetry(claims.productId, completed.generationMeta);
      return completed;
    } catch (error) {
      let releaseError: unknown;
      if (lease) {
        try { await this.fail(lease, error); } catch (caught) { releaseError = caught; }
      }
      const surfaced = releaseError || error;
      await this.emitTelemetry(claims.productId,
        this.failureMeta(surfaced, Math.max(0, Date.now() - operationStartedAt), attemptCount));
      if (releaseError) throw releaseError;
      throw error;
    }
  }

  private async generateUnverified(reportBody: NormalizedReportRequest) {
    const startedAt = Date.now();
    try {
      const rawPayload = await this.generateReport(reportBody);
      const payload = normalizeGeneratedReport(rawPayload, {
        model: this.config.gemini.model || null,
        latencyMs: Math.max(0, Date.now() - startedAt),
        attemptCount: 1,
        cacheStatus: 'bypass',
        reportMode: reportBody.reportMode,
        promptVersion: reportBody.promptVersion
      });
      await this.emitTelemetry(reportBody.serviceId, payload.generationMeta);
      return payload;
    } catch (error) {
      await this.emitTelemetry(reportBody.serviceId,
        this.failureMeta(error, Math.max(0, Date.now() - startedAt), 1));
      throw error;
    }
  }

  generate(reportAccess: ReportAccessClaims | null, reportBody: NormalizedReportRequest) {
    return reportAccess ? this.generatePaid(reportAccess, reportBody) : this.generateUnverified(reportBody);
  }
}
