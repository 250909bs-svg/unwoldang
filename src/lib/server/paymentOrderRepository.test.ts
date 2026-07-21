import { describe, expect, it, vi } from 'vitest';
import { ReportRequestError } from '../../../cloudrun-api/src/contracts/errors.ts';
import { PAYMENT_ADJUSTMENT_KIND, PAYMENT_ORDER_STATUS } from '../../../cloudrun-api/src/domains/payments/paymentContracts.ts';
import type { FirestoreRepository } from '../../../cloudrun-api/src/repositories/firestoreRepository.ts';
import {
  getPaymentOrderDocumentId,
  PaymentOrderRepository,
  type PaymentOrder,
  type TransitionPaymentOrderInput
} from '../../../cloudrun-api/src/repositories/paymentOrderRepository.ts';

const ORDER_ID = 'UW-20260722-repository-cas-0001';
const DOCUMENT_ID = getPaymentOrderDocumentId(ORDER_ID);
const COLLECTION = 'paymentOrdersFixture';
const UPDATE_TIME = '2026-07-22T01:00:00.000Z';

function order(status = PAYMENT_ORDER_STATUS.CREATED): PaymentOrder {
  return {
    documentId: DOCUMENT_ID,
    path: `/${COLLECTION}/${DOCUMENT_ID}`,
    orderId: ORDER_ID,
    productId: 'general-signature',
    amount: 79_000,
    currency: 'KRW',
    productStatusSnapshot: 'active',
    userId: 'user-a',
    userBinding: 'binding-a',
    orderClaimHash: 'a'.repeat(64),
    status,
    providerStatus: status === PAYMENT_ORDER_STATUS.PAID ? 'PAID' : '',
    paymentId: status === PAYMENT_ORDER_STATUS.PAID ? ORDER_ID : '',
    transactionId: status === PAYMENT_ORDER_STATUS.PAID ? 'tx-repository-cas' : '',
    source: 'created',
    createdAt: '2026-07-22T00:00:00.000Z',
    statusUpdatedAt: '2026-07-22T00:00:00.000Z',
    adjustmentId: '',
    adjustmentKind: '',
    adjustmentReason: '',
    adjustmentAt: '',
    createTime: '2026-07-22T00:00:00.000Z',
    updateTime: UPDATE_TIME
  };
}

function firestoreDocument(
  status: string,
  input: TransitionPaymentOrderInput
) {
  return {
    name: `projects/fixture/databases/(default)/documents/${COLLECTION}/${DOCUMENT_ID}`,
    fields: {
      orderId: { stringValue: ORDER_ID },
      productId: { stringValue: 'general-signature' },
      amount: { integerValue: '79000' },
      currency: { stringValue: 'KRW' },
      productStatusSnapshot: { stringValue: 'active' },
      userId: { stringValue: 'user-a' },
      userBinding: { stringValue: 'binding-a' },
      orderClaimHash: { stringValue: 'a'.repeat(64) },
      status: { stringValue: status },
      providerStatus: { stringValue: input.providerStatus },
      paymentId: { stringValue: input.paymentId },
      transactionId: { stringValue: input.transactionId },
      source: { stringValue: 'created' },
      createdAt: { timestampValue: '2026-07-22T00:00:00.000Z' },
      statusUpdatedAt: { timestampValue: input.statusUpdatedAt },
      adjustmentId: { stringValue: input.adjustment?.id || '' },
      adjustmentKind: { stringValue: input.adjustment?.kind || '' },
      adjustmentReason: { stringValue: input.adjustment?.reason || '' },
      ...(input.adjustment
        ? { adjustmentAt: { timestampValue: input.adjustment.occurredAt } }
        : {})
    },
    createTime: '2026-07-22T00:00:00.000Z',
    updateTime: '2026-07-22T01:00:01.000Z'
  };
}

function repositoryWith(request: ReturnType<typeof vi.fn>) {
  return new PaymentOrderRepository(
    { request } as unknown as FirestoreRepository,
    COLLECTION
  );
}

describe('PaymentOrderRepository CAS recovery', () => {
  it.each([
    [400, 'FAILED_PRECONDITION: update_time mismatch'],
    [409, 'conflict'],
    [412, 'precondition failed']
  ])('re-reads an identical paid transition after Firestore %i', async (status, message) => {
    const input: TransitionPaymentOrderInput = {
      status: PAYMENT_ORDER_STATUS.PAID,
      providerStatus: 'PAID',
      paymentId: ORDER_ID,
      transactionId: 'tx-repository-cas',
      statusUpdatedAt: '2026-07-22T01:00:00.000Z'
    };
    const request = vi
      .fn()
      .mockRejectedValueOnce(new ReportRequestError(status, message))
      .mockResolvedValueOnce(firestoreDocument(PAYMENT_ORDER_STATUS.PAID, input));

    const result = await repositoryWith(request).transition(order(), input);

    expect(result.status).toBe(PAYMENT_ORDER_STATUS.PAID);
    expect(request).toHaveBeenCalledTimes(2);
    const patchUrl = new URL(String(request.mock.calls[0][0]), 'https://fixture.invalid');
    expect(patchUrl.searchParams.get('currentDocument.updateTime')).toBe(UPDATE_TIME);
    expect(patchUrl.searchParams.getAll('updateMask.fieldPaths')).toContain('status');
  });

  it('recovers an idempotent refunded transition with the same adjustment ID', async () => {
    const input: TransitionPaymentOrderInput = {
      status: PAYMENT_ORDER_STATUS.REFUNDED,
      providerStatus: 'CANCELLED',
      paymentId: ORDER_ID,
      transactionId: 'tx-repository-cas',
      statusUpdatedAt: '2026-07-22T02:00:00.000Z',
      adjustment: {
        id: 'adjustment-repository-cas',
        kind: PAYMENT_ADJUSTMENT_KIND.REFUND,
        reason: 'verified provider refund',
        occurredAt: '2026-07-22T02:00:00.000Z'
      }
    };
    const request = vi
      .fn()
      .mockRejectedValueOnce(new ReportRequestError(400, 'FAILED_PRECONDITION'))
      .mockResolvedValueOnce(firestoreDocument(PAYMENT_ORDER_STATUS.REFUNDED, input));

    const result = await repositoryWith(request).transition(
      order(PAYMENT_ORDER_STATUS.PAID),
      input
    );

    expect(result).toMatchObject({
      status: PAYMENT_ORDER_STATUS.REFUNDED,
      adjustmentId: 'adjustment-repository-cas',
      adjustmentKind: PAYMENT_ADJUSTMENT_KIND.REFUND
    });
  });

  it('does not mask unrelated Firestore 400 responses as concurrency', async () => {
    const request = vi
      .fn()
      .mockRejectedValue(new ReportRequestError(400, 'Invalid document field.'));
    const input: TransitionPaymentOrderInput = {
      status: PAYMENT_ORDER_STATUS.PAID,
      providerStatus: 'PAID',
      paymentId: ORDER_ID,
      transactionId: 'tx-repository-cas',
      statusUpdatedAt: '2026-07-22T01:00:00.000Z'
    };

    await expect(repositoryWith(request).transition(order(), input)).rejects.toThrow(
      'Invalid document field.'
    );
    expect(request).toHaveBeenCalledTimes(1);
  });
});
