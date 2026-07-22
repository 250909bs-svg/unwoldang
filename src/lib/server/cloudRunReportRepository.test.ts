import { describe, expect, it, vi } from 'vitest';
import type { FirestoreRepository } from '../../../cloudrun-api/src/repositories/firestoreRepository.ts';
import {
  PaymentLedgerRepository,
  isFirestorePreconditionConflict,
  type PaymentLedger
} from '../../../cloudrun-api/src/repositories/paymentLedgerRepository.ts';
import {
  ReportPlatformError,
  ReportRequestError
} from '../../../cloudrun-api/src/contracts/errors.ts';

function createLedger(overrides: Partial<PaymentLedger> = {}): PaymentLedger {
  return {
    documentId: 'fixture-doc',
    path: '/ledgers/fixture-doc',
    paymentId: 'payment',
    orderId: 'order',
    productId: 'general-signature',
    amount: 79_000,
    currency: 'KRW',
    storeId: 'store',
    transactionId: 'tx',
    confirmedAt: '2026-01-01T00:00:00.000Z',
    userId: 'user',
    userBinding: 'binding',
    entitlementId: 'fixture-doc',
    orderClaimHash: 'hash',
    entitlementStatus: 'active',
    entitlementCreatedAt: '2026-01-01T00:00:00.000Z',
    reportInputHash: 'input-hash',
    reportGenerationStatus: 'generating',
    reportGenerationLockId: 'owned-lock',
    reportGenerationLockExpiresAt: '2026-01-01T00:02:00.000Z',
    reportGenerationStartedAt: '2026-01-01T00:00:00.000Z',
    reportGenerationAttempt: 1,
    reportGenerationCompletedAt: '',
    reportGenerationFailedAt: '',
    reportGenerationFailure: '',
    reportJson: '',
    reportJsonHash: '',
    reportCacheSchemaVersion: '',
    reportInputSchemaVersion: '',
    reportResponseSchemaVersion: '',
    reportGenerationMetaSchemaVersion: '',
    createTime: '2026-01-01T00:00:00.000Z',
    updateTime: '2026-01-01T00:00:01.000Z',
    ...overrides
  };
}

function createHarness() {
  const request = vi.fn(async (_path: string, init: { body?: string } = {}) => {
    const written = init.body ? JSON.parse(init.body).fields : {};
    return {
      name: 'projects/project/databases/(default)/documents/ledgers/fixture-doc',
      updateTime: '2026-01-01T00:00:02.000Z',
      fields: {
        paymentId: { stringValue: 'payment' },
        orderId: { stringValue: 'order' },
        productId: { stringValue: 'general-signature' },
        amount: { integerValue: '79000' },
        currency: { stringValue: 'KRW' },
        storeId: { stringValue: 'store' },
        transactionId: { stringValue: 'tx' },
        confirmedAt: { timestampValue: '2026-01-01T00:00:00.000Z' },
        userId: { stringValue: 'user' },
        userBinding: { stringValue: 'binding' },
        entitlementId: { stringValue: 'fixture-doc' },
        orderClaimHash: { stringValue: 'hash' },
        entitlementStatus: { stringValue: 'active' },
        entitlementCreatedAt: { timestampValue: '2026-01-01T00:00:00.000Z' },
        reportInputHash: { stringValue: 'input-hash' },
        reportGenerationStartedAt: { timestampValue: '2026-01-01T00:00:00.000Z' },
        reportGenerationAttempt: { integerValue: '1' },
        ...written
      }
    };
  });
  const repository = new PaymentLedgerRepository(
    { request } as unknown as FirestoreRepository,
    'ledgers'
  );
  return { repository, request };
}

describe('Cloud Run report ledger repository contracts', () => {
  it('uses updateTime CAS and clears every old cache version while acquiring', async () => {
    const { repository, request } = createHarness();
    await repository.acquireReportGeneration(createLedger(), {
      inputHash: 'input-hash',
      lockId: 'new-lock',
      lockExpiresAt: '2026-01-01T00:03:00.000Z',
      startedAt: '2026-01-01T00:01:00.000Z',
      attempt: 2
    });

    const [path, init] = request.mock.calls[0];
    expect(path).toContain(
      'currentDocument.updateTime=2026-01-01T00%3A00%3A01.000Z'
    );
    for (const field of [
      'reportCacheSchemaVersion',
      'reportInputSchemaVersion',
      'reportResponseSchemaVersion',
      'reportGenerationMetaSchemaVersion'
    ]) {
      expect(path).toContain(`updateMask.fieldPaths=${field}`);
    }
    const fields = JSON.parse(String(init?.body)).fields;
    expect(fields.reportGenerationLockId.stringValue).toBe('new-lock');
    expect(fields).not.toHaveProperty('reportCacheSchemaVersion');
  });

  it('requires the exact lock owner and writes only add-only cache metadata', async () => {
    const { repository, request } = createHarness();
    const completion = {
      completedAt: '2026-01-01T00:01:00.000Z',
      reportJson: '{}',
      reportJsonHash: 'a'.repeat(64),
      cacheSchemaVersion: 'report-cache-v1',
      inputSchemaVersion: 'report-request-v1',
      responseSchemaVersion: 'report-response-v1',
      generationMetaSchemaVersion: 'report-generation-meta-v1'
    };

    await expect(
      repository.completeReportGeneration(createLedger(), {
        ...completion,
        lockId: 'foreign-lock'
      })
    ).rejects.toBeInstanceOf(ReportPlatformError);
    expect(request).not.toHaveBeenCalled();

    await repository.completeReportGeneration(createLedger(), {
      ...completion,
      lockId: 'owned-lock'
    });
    const fields = JSON.parse(String(request.mock.calls[0][1]?.body)).fields;
    expect(fields).toMatchObject({
      reportCacheSchemaVersion: { stringValue: 'report-cache-v1' },
      reportInputSchemaVersion: { stringValue: 'report-request-v1' },
      reportResponseSchemaVersion: { stringValue: 'report-response-v1' },
      reportGenerationMetaSchemaVersion: {
        stringValue: 'report-generation-meta-v1'
      }
    });
    expect(fields).not.toHaveProperty('paymentId');
    expect(fields).not.toHaveProperty('orderId');
    expect(fields).not.toHaveProperty('amount');
  });

  it('releases only an owned lock and maps Firestore precondition conflicts', async () => {
    const { repository, request } = createHarness();
    await repository.failReportGeneration(createLedger(), {
      lockId: 'owned-lock',
      failedAt: '2026-01-01T00:01:00.000Z',
      failure: 'Error'
    });

    const [path] = request.mock.calls[0];
    expect(path).toContain('updateMask.fieldPaths=reportGenerationLockId');
    expect(path).toContain('currentDocument.updateTime=');
    expect(
      isFirestorePreconditionConflict(new ReportRequestError(412, 'stale'))
    ).toBe(true);
    expect(
      isFirestorePreconditionConflict(new ReportRequestError(500, 'boom'))
    ).toBe(false);
  });
});
