import { createHash } from 'node:crypto';
import { ReportRequestError } from '../contracts/errors.ts';
import {
  ENTITLEMENT_STATUS,
  type EntitlementStatus
} from '../domains/payments/paymentContracts.ts';
import { FirestoreRepository } from './firestoreRepository.ts';

type FirestoreValue = {
  stringValue?: string;
  integerValue?: string;
  timestampValue?: string;
};

type FirestoreDocument = {
  name?: string;
  fields?: Record<string, FirestoreValue>;
  createTime?: string;
  updateTime?: string;
};

type FirestoreRunQueryRow = {
  document?: FirestoreDocument;
};

export type PaymentLedger = {
  documentId: string;
  path: string;
  paymentId: string;
  orderId: string;
  productId: string;
  amount: number;
  currency: string;
  storeId: string;
  transactionId: string;
  confirmedAt: string;
  userId: string;
  userBinding: string;
  entitlementId: string;
  orderClaimHash: string;
  entitlementStatus: string;
  entitlementCreatedAt: string;
  entitlementUpdatedAt: string;
  entitlementRevokedAt: string;
  entitlementRevocationId: string;
  entitlementRevocationReason: string;
  entitlementRevocationProviderStatus: string;
  reportInputHash: string;
  reportGenerationStatus: string;
  reportGenerationLockId: string;
  reportGenerationLockExpiresAt: string;
  reportGenerationStartedAt: string;
  reportGenerationAttempt: number;
  reportGenerationCompletedAt: string;
  reportGenerationFailedAt: string;
  reportGenerationFailure: string;
  reportJson: string;
  reportJsonHash: string;
  createTime: string;
  updateTime: string;
};

export type PaymentLedgerRecord = PaymentLedger;

export type CreatePaymentLedgerInput = {
  paymentId: string;
  orderId: string;
  productId: string;
  amount: number;
  currency: string;
  storeId: string;
  transactionId: string;
  confirmedAt: string;
  userId: string;
  userBinding: string;
  entitlementId: string;
  orderClaimHash: string;
  entitlementStatus: string;
  entitlementCreatedAt: string;
  entitlementUpdatedAt: string;
};

export type RevokePaymentEntitlementInput = {
  status: Exclude<EntitlementStatus, typeof ENTITLEMENT_STATUS.ACTIVE>;
  revokedAt: string;
  revocationId: string;
  reason: string;
  providerStatus: string;
};

export type CreatePaymentLedgerResult =
  | {
      kind: 'created';
      created: true;
      ledger: PaymentLedger;
    }
  | {
      kind: 'existing';
      created: false;
      ledger: PaymentLedger;
    };

export type AcquireReportGenerationOptions = {
  inputHash: string;
  lockId: string;
  lockExpiresAt: string;
  startedAt: string;
  attempt: number;
};

export type CompleteReportGenerationOptions = {
  completedAt: string;
  reportJson: string;
  reportJsonHash: string;
};

export type FailReportGenerationOptions = {
  failedAt: string;
  failure: string;
};

const ACQUIRE_REPORT_GENERATION_UPDATE_MASK = [
  'reportInputHash',
  'reportGenerationStatus',
  'reportGenerationLockId',
  'reportGenerationLockExpiresAt',
  'reportGenerationStartedAt',
  'reportGenerationAttempt',
  'reportGenerationCompletedAt',
  'reportGenerationFailedAt',
  'reportGenerationFailure',
  'reportJson',
  'reportJsonHash'
];

const COMPLETE_REPORT_GENERATION_UPDATE_MASK = [
  'reportGenerationStatus',
  'reportGenerationCompletedAt',
  'reportGenerationLockId',
  'reportGenerationLockExpiresAt',
  'reportGenerationFailedAt',
  'reportGenerationFailure',
  'reportJson',
  'reportJsonHash'
];

const FAIL_REPORT_GENERATION_UPDATE_MASK = [
  'reportGenerationStatus',
  'reportGenerationLockId',
  'reportGenerationLockExpiresAt',
  'reportGenerationCompletedAt',
  'reportGenerationFailedAt',
  'reportGenerationFailure',
  'reportJson',
  'reportJsonHash'
];

const REVOKE_ENTITLEMENT_UPDATE_MASK = [
  'entitlementStatus',
  'entitlementUpdatedAt',
  'entitlementRevokedAt',
  'entitlementRevocationId',
  'entitlementRevocationReason',
  'entitlementRevocationProviderStatus'
];

function readString(document: FirestoreDocument, fieldName: string) {
  const value = document.fields?.[fieldName];

  return typeof value?.stringValue === 'string' ? value.stringValue : '';
}

function readInteger(document: FirestoreDocument, fieldName: string) {
  const value = document.fields?.[fieldName]?.integerValue;

  return typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : NaN;
}

function readTimestamp(document: FirestoreDocument, fieldName: string) {
  const value = document.fields?.[fieldName]?.timestampValue;

  return typeof value === 'string' ? value : '';
}

function documentIdFromName(name?: string) {
  if (!name) {
    return '';
  }

  return name.split('/').pop() || '';
}

function parsePaymentLedger(
  document: FirestoreDocument,
  documentId: string,
  path: string
): PaymentLedger {
  return {
    documentId,
    path,
    paymentId: readString(document, 'paymentId'),
    orderId: readString(document, 'orderId'),
    productId: readString(document, 'productId'),
    amount: readInteger(document, 'amount'),
    currency: readString(document, 'currency'),
    storeId: readString(document, 'storeId'),
    transactionId: readString(document, 'transactionId'),
    confirmedAt: readTimestamp(document, 'confirmedAt'),
    userId: readString(document, 'userId'),
    userBinding: readString(document, 'userBinding'),
    entitlementId: readString(document, 'entitlementId'),
    orderClaimHash: readString(document, 'orderClaimHash'),
    entitlementStatus: readString(document, 'entitlementStatus'),
    entitlementCreatedAt: readTimestamp(document, 'entitlementCreatedAt'),
    entitlementUpdatedAt: readTimestamp(document, 'entitlementUpdatedAt'),
    entitlementRevokedAt: readTimestamp(document, 'entitlementRevokedAt'),
    entitlementRevocationId: readString(document, 'entitlementRevocationId'),
    entitlementRevocationReason: readString(
      document,
      'entitlementRevocationReason'
    ),
    entitlementRevocationProviderStatus: readString(
      document,
      'entitlementRevocationProviderStatus'
    ),
    reportInputHash: readString(document, 'reportInputHash'),
    reportGenerationStatus: readString(document, 'reportGenerationStatus'),
    reportGenerationLockId: readString(document, 'reportGenerationLockId'),
    reportGenerationLockExpiresAt: readTimestamp(
      document,
      'reportGenerationLockExpiresAt'
    ),
    reportGenerationStartedAt: readTimestamp(document, 'reportGenerationStartedAt'),
    reportGenerationAttempt: readInteger(document, 'reportGenerationAttempt'),
    reportGenerationCompletedAt: readTimestamp(
      document,
      'reportGenerationCompletedAt'
    ),
    reportGenerationFailedAt: readTimestamp(document, 'reportGenerationFailedAt'),
    reportGenerationFailure: readString(document, 'reportGenerationFailure'),
    reportJson: readString(document, 'reportJson'),
    reportJsonHash: readString(document, 'reportJsonHash'),
    createTime: typeof document.createTime === 'string' ? document.createTime : '',
    updateTime: typeof document.updateTime === 'string' ? document.updateTime : ''
  };
}

export function getPaymentLedgerDocumentId(paymentId: string) {
  return createHash('sha256').update(`portone:${paymentId}`).digest('hex');
}

export function isFirestorePreconditionConflict(error: unknown) {
  return (
    error instanceof ReportRequestError &&
    (error.status === 409 ||
      error.status === 412 ||
      (error.status === 400 &&
        /precondition|update.?time|failed_precondition/i.test(error.message)))
  );
}

export class PaymentLedgerRepository {
  constructor(
    private readonly firestore: FirestoreRepository,
    private readonly collection: string
  ) {}

  getDocumentId(paymentId: string) {
    return getPaymentLedgerDocumentId(paymentId);
  }

  private getDocumentPath(paymentId: string) {
    return this.getDocumentPathById(getPaymentLedgerDocumentId(paymentId));
  }

  private getDocumentPathById(documentId: string) {
    return `/${encodeURIComponent(this.collection)}/${documentId}`;
  }

  private parseDocument(document: FirestoreDocument, fallbackDocumentId = '') {
    const documentId = documentIdFromName(document.name) || fallbackDocumentId;

    return parsePaymentLedger(
      document,
      documentId,
      documentId ? this.getDocumentPathById(documentId) : ''
    );
  }

  private getPatchPath(ledger: PaymentLedger, fieldPaths: string[]) {
    const params = new URLSearchParams();

    fieldPaths.forEach((fieldPath) => params.append('updateMask.fieldPaths', fieldPath));
    params.set('currentDocument.updateTime', ledger.updateTime);

    return `${ledger.path}?${params.toString()}`;
  }

  async create(input: CreatePaymentLedgerInput): Promise<CreatePaymentLedgerResult> {
    const documentId = getPaymentLedgerDocumentId(input.paymentId);

    try {
      const document = await this.firestore.request<FirestoreDocument>(
        `/${encodeURIComponent(this.collection)}?documentId=${encodeURIComponent(documentId)}`,
        {
          method: 'POST',
          body: JSON.stringify({
            fields: {
              paymentId: { stringValue: input.paymentId },
              orderId: { stringValue: input.orderId },
              productId: { stringValue: input.productId },
              amount: { integerValue: String(input.amount) },
              currency: { stringValue: input.currency },
              storeId: { stringValue: input.storeId },
              transactionId: { stringValue: input.transactionId },
              confirmedAt: { timestampValue: input.confirmedAt },
              userId: { stringValue: input.userId },
              userBinding: { stringValue: input.userBinding },
              entitlementId: { stringValue: input.entitlementId },
              orderClaimHash: { stringValue: input.orderClaimHash },
              entitlementStatus: { stringValue: input.entitlementStatus },
              entitlementCreatedAt: { timestampValue: input.entitlementCreatedAt },
              entitlementUpdatedAt: { timestampValue: input.entitlementUpdatedAt },
              entitlementRevocationId: { stringValue: '' },
              entitlementRevocationReason: { stringValue: '' },
              entitlementRevocationProviderStatus: { stringValue: '' }
            }
          })
        }
      );

      return {
        kind: 'created',
        created: true,
        ledger: this.parseDocument(document, documentId)
      };
    } catch (error) {
      if (!(error instanceof ReportRequestError) || error.status !== 409) {
        throw error;
      }

      return {
        kind: 'existing',
        created: false,
        ledger: await this.get(input.paymentId)
      };
    }
  }

  async get(paymentId: string) {
    return this.getByDocumentId(getPaymentLedgerDocumentId(paymentId));
  }

  async getByDocumentId(documentId: string) {
    const document = await this.firestore.request<FirestoreDocument>(
      this.getDocumentPathById(documentId)
    );

    return this.parseDocument(document, documentId);
  }

  async listByUser(userId: string, limit = 100) {
    const queryLimit =
      Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, 100) : 100;
    const rows = await this.firestore.request<FirestoreRunQueryRow[]>(':runQuery', {
      method: 'POST',
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: this.collection }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'userId' },
              op: 'EQUAL',
              value: { stringValue: userId }
            }
          },
          limit: queryLimit
        }
      })
    });

    if (!Array.isArray(rows)) {
      return [];
    }

    return rows
      .map((row) => row?.document)
      .filter((document): document is FirestoreDocument => Boolean(document))
      .map((document) => this.parseDocument(document));
  }

  async acquireReportGeneration(
    ledger: PaymentLedger,
    input: AcquireReportGenerationOptions
  ) {
    const document = await this.firestore.request<FirestoreDocument>(
      this.getPatchPath(ledger, ACQUIRE_REPORT_GENERATION_UPDATE_MASK),
      {
        method: 'PATCH',
        body: JSON.stringify({
          fields: {
            reportInputHash: { stringValue: input.inputHash },
            reportGenerationStatus: { stringValue: 'generating' },
            reportGenerationLockId: { stringValue: input.lockId },
            reportGenerationLockExpiresAt: { timestampValue: input.lockExpiresAt },
            reportGenerationStartedAt: { timestampValue: input.startedAt },
            reportGenerationAttempt: { integerValue: String(input.attempt) }
          }
        })
      }
    );

    return this.parseDocument(document, ledger.documentId);
  }

  async completeReportGeneration(
    ledger: PaymentLedger,
    input: CompleteReportGenerationOptions
  ) {
    const document = await this.firestore.request<FirestoreDocument>(
      this.getPatchPath(ledger, COMPLETE_REPORT_GENERATION_UPDATE_MASK),
      {
        method: 'PATCH',
        body: JSON.stringify({
          fields: {
            reportGenerationStatus: { stringValue: 'completed' },
            reportGenerationCompletedAt: { timestampValue: input.completedAt },
            reportJson: { stringValue: input.reportJson },
            reportJsonHash: { stringValue: input.reportJsonHash }
          }
        })
      }
    );

    return this.parseDocument(document, ledger.documentId);
  }

  async failReportGeneration(
    ledger: PaymentLedger,
    input: FailReportGenerationOptions
  ) {
    const document = await this.firestore.request<FirestoreDocument>(
      this.getPatchPath(ledger, FAIL_REPORT_GENERATION_UPDATE_MASK),
      {
        method: 'PATCH',
        body: JSON.stringify({
          fields: {
            reportGenerationStatus: { stringValue: 'failed' },
            reportGenerationLockExpiresAt: { timestampValue: input.failedAt },
            reportGenerationFailedAt: { timestampValue: input.failedAt },
            reportGenerationFailure: { stringValue: input.failure }
          }
        })
      }
    );

    return this.parseDocument(document, ledger.documentId);
  }

  async revokeEntitlement(
    entitlementId: string,
    input: RevokePaymentEntitlementInput
  ) {
    const ledger = await this.getByDocumentId(entitlementId);

    if (
      ledger.entitlementStatus === input.status &&
      ledger.entitlementRevocationId === input.revocationId
    ) {
      return ledger;
    }

    const canRevoke =
      ledger.entitlementStatus === ENTITLEMENT_STATUS.ACTIVE ||
      (ledger.entitlementStatus === ENTITLEMENT_STATUS.REVOKED &&
        input.status === ENTITLEMENT_STATUS.REFUNDED);

    if (!canRevoke) {
      throw new ReportRequestError(
        409,
        'Entitlement cannot transition to the requested inactive status.'
      );
    }

    try {
      const document = await this.firestore.request<FirestoreDocument>(
        this.getPatchPath(ledger, REVOKE_ENTITLEMENT_UPDATE_MASK),
        {
          method: 'PATCH',
          body: JSON.stringify({
            fields: {
              entitlementStatus: { stringValue: input.status },
              entitlementUpdatedAt: { timestampValue: input.revokedAt },
              entitlementRevokedAt: { timestampValue: input.revokedAt },
              entitlementRevocationId: { stringValue: input.revocationId },
              entitlementRevocationReason: { stringValue: input.reason },
              entitlementRevocationProviderStatus: {
                stringValue: input.providerStatus
              }
            }
          })
        }
      );

      return this.parseDocument(document, ledger.documentId);
    } catch (error) {
      if (!isFirestorePreconditionConflict(error)) {
        throw error;
      }

      const current = await this.getByDocumentId(entitlementId);

      if (
        current.entitlementStatus === input.status &&
        current.entitlementRevocationId === input.revocationId
      ) {
        return current;
      }

      throw error;
    }
  }

  createPaymentLedger(input: CreatePaymentLedgerInput) {
    return this.create(input);
  }

  getPaymentLedger(entitlementId: string) {
    return this.getByDocumentId(entitlementId);
  }

  listPaymentLedgersByUserId(userId: string, limit = 100) {
    return this.listByUser(userId, limit);
  }

  revokePaymentEntitlement(
    entitlementId: string,
    input: RevokePaymentEntitlementInput
  ) {
    return this.revokeEntitlement(entitlementId, input);
  }

  isPreconditionConflict(error: unknown) {
    return isFirestorePreconditionConflict(error);
  }
}
