import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { AppConfig } from '../../config/env.ts';
import type { ReportAccessClaims } from '../../contracts/auth.ts';
import {
  ReportGenerationInProgressError,
  ReportRequestError
} from '../../contracts/errors.ts';
import type { PaymentLedger } from '../../repositories/paymentLedgerRepository.ts';
import type { generateGeminiSajuReport } from '../../../../src/lib/server/geminiReportService.ts';

export type ReportResponsePayload = Awaited<ReturnType<typeof generateGeminiSajuReport>>;

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
    input: { completedAt: string; reportJson: string; reportJsonHash: string }
  ): Promise<ReportLedger>;
  failReportGeneration(
    ledger: ReportLedger,
    input: { failedAt: string; failure: string }
  ): Promise<ReportLedger>;
  isPreconditionConflict(error: unknown): boolean;
};

type ReportGenerator = (body: Record<string, unknown>) => Promise<ReportResponsePayload>;

type ReportGenerationLease = {
  kind: 'acquired';
  inputHash: string;
  ledger: ReportLedger;
};

type ReportGenerationResult =
  | ReportGenerationLease
  | {
      kind: 'cached';
      payload: ReportResponsePayload;
    };

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function canonicalJson(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new ReportRequestError(400, 'Report request contains a non-finite number.');
    }

    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const keys = Object.keys(source).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(source[key])}`).join(',')}}`;
  }

  throw new ReportRequestError(400, 'Report request contains an unsupported value.');
}

export class ReportService {
  constructor(
    private readonly config: AppConfig,
    private readonly ledgerRepository: ReportLedgerRepository,
    private readonly generateReport: ReportGenerator
  ) {}

  private getInputHash(claims: ReportAccessClaims, reportBody: Record<string, unknown>) {
    const canonicalInput = canonicalJson({
      version: 'unwoldang-report-input-v1',
      paymentId: claims.paymentId,
      orderId: claims.orderId,
      productId: claims.productId,
      amount: claims.amount,
      request: reportBody
    });

    return createHash('sha256').update(canonicalInput).digest('hex');
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
      throw new ReportRequestError(403, 'Report token does not match the confirmed payment ledger.');
    }
  }

  private assertCompatibleInput(ledger: ReportLedger, inputHash: string) {
    if (ledger.reportInputHash && ledger.reportInputHash !== inputHash) {
      throw new ReportRequestError(409, 'This payment has already been bound to a different report input.');
    }
  }

  private parseCompletedReport(ledger: ReportLedger, inputHash: string): ReportResponsePayload | null {
    if (ledger.reportGenerationStatus !== 'completed') {
      return null;
    }

    if (ledger.reportInputHash !== inputHash) {
      throw new ReportRequestError(409, 'This payment has already been used for a different report input.');
    }

    const reportJson = ledger.reportJson;

    if (!reportJson || Buffer.byteLength(reportJson, 'utf8') > this.config.report.cacheMaxBytes) {
      throw new ReportRequestError(503, 'The saved report cache is unavailable or exceeds its safety limit.');
    }

    const actualHash = createHash('sha256').update(reportJson).digest('hex');

    if (!/^[a-f0-9]{64}$/.test(ledger.reportJsonHash) || !safeEqual(ledger.reportJsonHash, actualHash)) {
      throw new ReportRequestError(503, 'The saved report cache failed its integrity check.');
    }

    try {
      const payload = JSON.parse(reportJson) as unknown;

      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('Invalid cached report shape.');
      }

      return payload as ReportResponsePayload;
    } catch {
      throw new ReportRequestError(503, 'The saved report cache could not be decoded.');
    }
  }

  private async readLedger(claims: ReportAccessClaims) {
    try {
      const ledger = await this.ledgerRepository.get(claims.paymentId);
      this.assertLedgerMatchesClaims(ledger, claims);
      return ledger;
    } catch (error) {
      if (error instanceof ReportRequestError && error.status === 404) {
        throw new ReportRequestError(403, 'Confirmed payment ledger was not found for this report token.');
      }

      throw error;
    }
  }

  private async resolveContention(
    claims: ReportAccessClaims,
    inputHash: string
  ): Promise<ReportGenerationResult> {
    const current = await this.readLedger(claims);
    this.assertCompatibleInput(current, inputHash);
    const cached = this.parseCompletedReport(current, inputHash);

    if (cached) {
      return { kind: 'cached', payload: cached };
    }

    throw new ReportGenerationInProgressError();
  }

  private async acquire(
    claims: ReportAccessClaims,
    reportBody: Record<string, unknown>
  ): Promise<ReportGenerationResult> {
    const inputHash = this.getInputHash(claims, reportBody);
    const ledger = await this.readLedger(claims);
    this.assertCompatibleInput(ledger, inputHash);
    const cached = this.parseCompletedReport(ledger, inputHash);

    if (cached) {
      return { kind: 'cached', payload: cached };
    }

    const status = ledger.reportGenerationStatus;
    const lockExpiresAt = Date.parse(ledger.reportGenerationLockExpiresAt);

    if (status === 'generating' && (!Number.isFinite(lockExpiresAt) || lockExpiresAt > Date.now())) {
      throw new ReportGenerationInProgressError();
    }

    if (status && status !== 'generating' && status !== 'failed') {
      throw new ReportRequestError(503, 'The payment ledger contains an invalid report generation state.');
    }

    if (!ledger.updateTime) {
      throw new ReportRequestError(503, 'The payment ledger does not expose a concurrency version.');
    }

    const now = Date.now();
    const previousAttempt = ledger.reportGenerationAttempt;
    const attempt = Number.isSafeInteger(previousAttempt) && previousAttempt >= 0 ? previousAttempt + 1 : 1;

    try {
      const acquired = await this.ledgerRepository.acquireReportGeneration(ledger, {
        inputHash,
        lockId: randomBytes(18).toString('base64url'),
        lockExpiresAt: new Date(now + this.config.report.generationLockTtlMs).toISOString(),
        startedAt: new Date(now).toISOString(),
        attempt
      });

      if (!acquired.updateTime) {
        throw new ReportRequestError(503, 'The report generation lock has no concurrency version.');
      }

      return { kind: 'acquired', inputHash, ledger: acquired };
    } catch (error) {
      if (this.ledgerRepository.isPreconditionConflict(error)) {
        return this.resolveContention(claims, inputHash);
      }

      throw error;
    }
  }

  private async complete(
    claims: ReportAccessClaims,
    lease: ReportGenerationLease,
    payload: ReportResponsePayload
  ) {
    const reportJson = JSON.stringify(payload);

    if (!reportJson || Buffer.byteLength(reportJson, 'utf8') > this.config.report.cacheMaxBytes) {
      throw new ReportRequestError(413, 'Generated report exceeds the 900 KB persistence safety limit.');
    }

    try {
      await this.ledgerRepository.completeReportGeneration(lease.ledger, {
        completedAt: new Date().toISOString(),
        reportJson,
        reportJsonHash: createHash('sha256').update(reportJson).digest('hex')
      });
      return payload;
    } catch (writeError) {
      try {
        const current = await this.readLedger(claims);
        this.assertCompatibleInput(current, lease.inputHash);
        const cached = this.parseCompletedReport(current, lease.inputHash);

        if (cached) {
          return cached;
        }
      } catch (readError) {
        console.error('Report cache verification after completion write failed:', readError);
      }

      throw writeError;
    }
  }

  private async fail(lease: ReportGenerationLease, error: unknown) {
    const failure =
      error instanceof ReportRequestError
        ? `${error.name}:${error.status}`
        : error instanceof Error
          ? error.name.slice(0, 120)
          : 'UnknownError';

    try {
      await this.ledgerRepository.failReportGeneration(lease.ledger, {
        failedAt: new Date().toISOString(),
        failure
      });
    } catch (recoveryError) {
      console.error('Failed to release report generation lock:', recoveryError);
    }
  }

  private async generatePaid(claims: ReportAccessClaims, reportBody: Record<string, unknown>) {
    const generation = await this.acquire(claims, reportBody);

    if (generation.kind === 'cached') {
      return generation.payload;
    }

    try {
      const payload = await this.generateReport(reportBody);

      if (payload.provider === 'deterministic-fallback') {
        await this.fail(
          generation,
          new ReportRequestError(503, 'AI enhancement returned a retryable deterministic fallback.')
        );
        return payload;
      }

      return await this.complete(claims, generation, payload);
    } catch (error) {
      await this.fail(generation, error);
      throw error;
    }
  }

  generate(reportAccess: ReportAccessClaims | null, reportBody: Record<string, unknown>) {
    return reportAccess ? this.generatePaid(reportAccess, reportBody) : this.generateReport(reportBody);
  }
}
