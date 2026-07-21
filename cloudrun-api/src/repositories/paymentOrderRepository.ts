import { createHash } from 'node:crypto';
import { PaymentRequestError, ReportRequestError } from '../contracts/errors.ts';
import {
  assertPaymentOrderTransition,
  isPaymentOrderStatus,
  PAYMENT_ORDER_STATUS,
  type PaymentAdjustmentKind,
  type PaymentOrderStatus
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

export type PaymentOrder = {
  [field: string]: unknown;
  documentId: string;
  path: string;
  orderId: string;
  productId: string;
  amount: number;
  currency: string;
  productStatusSnapshot: string;
  userId: string;
  userBinding: string;
  orderClaimHash: string;
  status: PaymentOrderStatus;
  providerStatus: string;
  paymentId: string;
  transactionId: string;
  source: string;
  createdAt: string;
  statusUpdatedAt: string;
  adjustmentId: string;
  adjustmentKind: string;
  adjustmentReason: string;
  adjustmentAt: string;
  createTime: string;
  updateTime: string;
};

export type CreatePaymentOrderInput = {
  orderId: string;
  productId: string;
  amount: number;
  currency: string;
  productStatusSnapshot: string;
  userId: string;
  userBinding: string;
  orderClaimHash: string;
  status: PaymentOrderStatus;
  source: 'created' | 'legacy';
  createdAt: string;
};

export type PaymentOrderAdjustment = {
  id: string;
  kind: PaymentAdjustmentKind;
  reason: string;
  occurredAt: string;
};

export type TransitionPaymentOrderInput = {
  status: PaymentOrderStatus;
  providerStatus: string;
  paymentId: string;
  transactionId: string;
  statusUpdatedAt: string;
  adjustment?: PaymentOrderAdjustment;
};

export type CreatePaymentOrderResult =
  | { kind: 'created'; order: PaymentOrder }
  | { kind: 'existing'; order: PaymentOrder };

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
  return name?.split('/').pop() || '';
}

export function getPaymentOrderDocumentId(orderId: string) {
  return createHash('sha256').update(`portone-order:${orderId}`).digest('hex');
}

function parsePaymentOrder(
  document: FirestoreDocument,
  documentId: string,
  path: string
): PaymentOrder {
  const rawStatus = readString(document, 'status');

  if (!isPaymentOrderStatus(rawStatus)) {
    throw new PaymentRequestError(409, 'Stored payment order has an invalid status.');
  }

  return {
    documentId,
    path,
    orderId: readString(document, 'orderId'),
    productId: readString(document, 'productId'),
    amount: readInteger(document, 'amount'),
    currency: readString(document, 'currency'),
    productStatusSnapshot: readString(document, 'productStatusSnapshot'),
    userId: readString(document, 'userId'),
    userBinding: readString(document, 'userBinding'),
    orderClaimHash: readString(document, 'orderClaimHash'),
    status: rawStatus,
    providerStatus: readString(document, 'providerStatus'),
    paymentId: readString(document, 'paymentId'),
    transactionId: readString(document, 'transactionId'),
    source: readString(document, 'source'),
    createdAt: readTimestamp(document, 'createdAt'),
    statusUpdatedAt: readTimestamp(document, 'statusUpdatedAt'),
    adjustmentId: readString(document, 'adjustmentId'),
    adjustmentKind: readString(document, 'adjustmentKind'),
    adjustmentReason: readString(document, 'adjustmentReason'),
    adjustmentAt: readTimestamp(document, 'adjustmentAt'),
    createTime: typeof document.createTime === 'string' ? document.createTime : '',
    updateTime: typeof document.updateTime === 'string' ? document.updateTime : ''
  };
}

function isSameTransition(order: PaymentOrder, input: TransitionPaymentOrderInput) {
  return (
    order.status === input.status &&
    order.providerStatus === input.providerStatus &&
    order.paymentId === input.paymentId &&
    order.transactionId === input.transactionId &&
    order.adjustmentId === (input.adjustment?.id || '')
  );
}

export class PaymentOrderRepository {
  constructor(
    private readonly firestore: FirestoreRepository,
    private readonly collection: string
  ) {}

  private getDocumentPathById(documentId: string) {
    return `/${encodeURIComponent(this.collection)}/${documentId}`;
  }

  private parseDocument(document: FirestoreDocument, fallbackDocumentId = '') {
    const documentId = documentIdFromName(document.name) || fallbackDocumentId;
    return parsePaymentOrder(
      document,
      documentId,
      documentId ? this.getDocumentPathById(documentId) : ''
    );
  }

  async create(input: CreatePaymentOrderInput): Promise<CreatePaymentOrderResult> {
    const documentId = getPaymentOrderDocumentId(input.orderId);

    try {
      const document = await this.firestore.request<FirestoreDocument>(
        `/${encodeURIComponent(this.collection)}?documentId=${encodeURIComponent(documentId)}`,
        {
          method: 'POST',
          body: JSON.stringify({
            fields: {
              orderId: { stringValue: input.orderId },
              productId: { stringValue: input.productId },
              amount: { integerValue: String(input.amount) },
              currency: { stringValue: input.currency },
              productStatusSnapshot: { stringValue: input.productStatusSnapshot },
              userId: { stringValue: input.userId },
              userBinding: { stringValue: input.userBinding },
              orderClaimHash: { stringValue: input.orderClaimHash },
              status: { stringValue: input.status },
              providerStatus: { stringValue: '' },
              paymentId: { stringValue: '' },
              transactionId: { stringValue: '' },
              source: { stringValue: input.source },
              createdAt: { timestampValue: input.createdAt },
              statusUpdatedAt: { timestampValue: input.createdAt },
              adjustmentId: { stringValue: '' },
              adjustmentKind: { stringValue: '' },
              adjustmentReason: { stringValue: '' }
            }
          })
        }
      );

      return { kind: 'created', order: this.parseDocument(document, documentId) };
    } catch (error) {
      if (!(error instanceof ReportRequestError) || error.status !== 409) {
        throw error;
      }

      const existing = await this.get(input.orderId);

      if (!existing) {
        throw error;
      }

      return { kind: 'existing', order: existing };
    }
  }

  async get(orderId: string): Promise<PaymentOrder | null> {
    const documentId = getPaymentOrderDocumentId(orderId);

    try {
      const document = await this.firestore.request<FirestoreDocument>(
        this.getDocumentPathById(documentId)
      );
      return this.parseDocument(document, documentId);
    } catch (error) {
      if (error instanceof ReportRequestError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async transition(order: PaymentOrder, input: TransitionPaymentOrderInput) {
    assertPaymentOrderTransition(order.status, input.status);

    if (isSameTransition(order, input)) {
      return order;
    }

    if (!order.path || !order.updateTime) {
      throw new PaymentRequestError(409, 'Stored payment order version is missing.');
    }

    const updateMask = [
      'status',
      'providerStatus',
      'paymentId',
      'transactionId',
      'statusUpdatedAt',
      'adjustmentId',
      'adjustmentKind',
      'adjustmentReason',
      'adjustmentAt'
    ];
    const params = new URLSearchParams();
    updateMask.forEach((fieldPath) => params.append('updateMask.fieldPaths', fieldPath));
    params.set('currentDocument.updateTime', order.updateTime);
    const adjustment = input.adjustment;

    try {
      const document = await this.firestore.request<FirestoreDocument>(
        `${order.path}?${params.toString()}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            fields: {
              status: { stringValue: input.status },
              providerStatus: { stringValue: input.providerStatus },
              paymentId: { stringValue: input.paymentId },
              transactionId: { stringValue: input.transactionId },
              statusUpdatedAt: { timestampValue: input.statusUpdatedAt },
              adjustmentId: { stringValue: adjustment?.id || '' },
              adjustmentKind: { stringValue: adjustment?.kind || '' },
              adjustmentReason: { stringValue: adjustment?.reason || '' },
              ...(adjustment
                ? { adjustmentAt: { timestampValue: adjustment.occurredAt } }
                : {})
            }
          })
        }
      );

      return this.parseDocument(document, order.documentId);
    } catch (error) {
      const isConflict =
        error instanceof ReportRequestError &&
        (error.status === 409 ||
          error.status === 412 ||
          (error.status === 400 &&
            /precondition|update.?time|failed_precondition/i.test(error.message)));

      if (!isConflict) {
        throw error;
      }

      const current = await this.get(order.orderId);

      if (current && isSameTransition(current, input)) {
        return current;
      }

      throw new PaymentRequestError(409, 'Payment order changed concurrently.');
    }
  }

  createPaymentOrder(input: CreatePaymentOrderInput) {
    return this.create(input);
  }

  getPaymentOrder(orderId: string) {
    return this.get(orderId);
  }

  transitionPaymentOrder(order: PaymentOrder, input: TransitionPaymentOrderInput) {
    return this.transition(order, input);
  }
}

export { PAYMENT_ORDER_STATUS };
