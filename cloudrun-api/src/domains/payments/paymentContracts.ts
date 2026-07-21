import { PaymentRequestError } from '../../contracts/errors.ts';

export const PAYMENT_ORDER_STATUS = Object.freeze({
  CREATED: 'created',
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded'
} as const);

export type PaymentOrderStatus =
  (typeof PAYMENT_ORDER_STATUS)[keyof typeof PAYMENT_ORDER_STATUS];

export const ENTITLEMENT_STATUS = Object.freeze({
  ACTIVE: 'active',
  REVOKED: 'revoked',
  REFUNDED: 'refunded'
} as const);

export type EntitlementStatus =
  (typeof ENTITLEMENT_STATUS)[keyof typeof ENTITLEMENT_STATUS];

export const PAYMENT_ADJUSTMENT_KIND = Object.freeze({
  CANCELLATION: 'cancellation',
  REFUND: 'refund'
} as const);

export type PaymentAdjustmentKind =
  (typeof PAYMENT_ADJUSTMENT_KIND)[keyof typeof PAYMENT_ADJUSTMENT_KIND];

const ORDER_TRANSITIONS: Readonly<Record<PaymentOrderStatus, readonly PaymentOrderStatus[]>> =
  Object.freeze({
    [PAYMENT_ORDER_STATUS.CREATED]: Object.freeze([
      PAYMENT_ORDER_STATUS.PENDING,
      PAYMENT_ORDER_STATUS.PAID,
      PAYMENT_ORDER_STATUS.FAILED,
      PAYMENT_ORDER_STATUS.CANCELLED
    ]),
    [PAYMENT_ORDER_STATUS.PENDING]: Object.freeze([
      PAYMENT_ORDER_STATUS.PAID,
      PAYMENT_ORDER_STATUS.FAILED,
      PAYMENT_ORDER_STATUS.CANCELLED
    ]),
    [PAYMENT_ORDER_STATUS.PAID]: Object.freeze([
      PAYMENT_ORDER_STATUS.REFUNDED
    ]),
    [PAYMENT_ORDER_STATUS.FAILED]: Object.freeze([]),
    [PAYMENT_ORDER_STATUS.CANCELLED]: Object.freeze([]),
    [PAYMENT_ORDER_STATUS.REFUNDED]: Object.freeze([])
  });

export function isPaymentOrderStatus(value: unknown): value is PaymentOrderStatus {
  return Object.values(PAYMENT_ORDER_STATUS).includes(value as PaymentOrderStatus);
}

export function assertPaymentOrderTransition(
  currentStatus: PaymentOrderStatus,
  nextStatus: PaymentOrderStatus
) {
  if (currentStatus === nextStatus) {
    return;
  }

  if (!ORDER_TRANSITIONS[currentStatus].includes(nextStatus)) {
    throw new PaymentRequestError(
      409,
      `Payment order cannot transition from ${currentStatus} to ${nextStatus}.`
    );
  }
}

export function getOrderStatusForProviderStatus(
  providerStatus: string,
  currentStatus: PaymentOrderStatus
): PaymentOrderStatus {
  switch (providerStatus) {
    case 'READY':
    case 'PENDING':
    case 'PAY_PENDING':
    case 'VIRTUAL_ACCOUNT_ISSUED':
      return PAYMENT_ORDER_STATUS.PENDING;
    case 'PAID':
      return PAYMENT_ORDER_STATUS.PAID;
    case 'FAILED':
      return PAYMENT_ORDER_STATUS.FAILED;
    case 'CANCELLED':
    case 'PARTIAL_CANCELLED':
      return currentStatus === PAYMENT_ORDER_STATUS.PAID ||
        currentStatus === PAYMENT_ORDER_STATUS.REFUNDED
        ? PAYMENT_ORDER_STATUS.REFUNDED
        : PAYMENT_ORDER_STATUS.CANCELLED;
    default:
      throw new PaymentRequestError(
        409,
        `Unsupported PortOne payment status: ${providerStatus || 'UNKNOWN'}`
      );
  }
}

export function getAdjustmentKindForOrderStatus(
  status: PaymentOrderStatus
): PaymentAdjustmentKind | undefined {
  if (status === PAYMENT_ORDER_STATUS.CANCELLED) {
    return PAYMENT_ADJUSTMENT_KIND.CANCELLATION;
  }

  if (status === PAYMENT_ORDER_STATUS.REFUNDED) {
    return PAYMENT_ADJUSTMENT_KIND.REFUND;
  }

  return undefined;
}
