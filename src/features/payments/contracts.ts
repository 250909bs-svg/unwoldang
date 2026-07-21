import type { IntakeFormData } from '../../api/mockData';
import type { AnalysisRequestPayload } from '../../lib/analysisPayload';
import { productIds, type ProductId } from '../../products/types';

export const paymentOrderStatuses = [
  'created',
  'pending',
  'paid',
  'failed',
  'cancelled',
  'refunded'
] as const;

export type PaymentOrderStatus = (typeof paymentOrderStatuses)[number];
export type PaymentEntitlementStatus = 'active' | 'revoked';
export type PaymentUiPhase =
  | 'idle'
  | 'creating-order'
  | 'opening-payment'
  | 'confirming'
  | 'success'
  | 'cancelled'
  | 'failed'
  | 'retryable';

export interface PaymentEntitlement {
  id: string;
  status: PaymentEntitlementStatus;
  createdAt: string;
}

export interface PaymentOrderIntent {
  orderId: string;
  productId: ProductId;
  amount: number;
  currency: 'KRW';
  orderStatus: 'created';
  orderClaim: string;
  orderClaimExpiresAt: string;
}

export interface ConfirmedPayment {
  paymentId: string;
  txId: string;
  orderId: string;
  productId: ProductId;
  amount: number;
  currency: 'KRW';
  status: 'PAID';
  orderStatus: 'paid';
  entitlement: PaymentEntitlement & { status: 'active' };
  method?: string;
  approvedAt?: string;
  reportAccessToken: string;
  reportAccessTokenExpiresAt: string;
}

export interface PaymentSession {
  schemaVersion: 1;
  ownerId: string;
  orderId: string;
  productId: ProductId;
  paymentMethod: 'portone';
  amount: number;
  currency: 'KRW';
  status: PaymentOrderStatus;
  createdAt: string;
  updatedAt: string;
  customerKey?: string;
  formData?: Partial<IntakeFormData>;
  analysisPayload?: AnalysisRequestPayload;
  tabOrigin?: string;
  paymentId?: string;
  paymentKey?: string;
  txId?: string;
  orderClaim?: string;
  orderClaimExpiresAt?: string;
  entitlementId?: string;
  entitlementStatus?: PaymentEntitlementStatus;
  reportAccessToken?: string;
  reportAccessTokenExpiresAt?: string;
  isDemo?: boolean;
}

const ORDER_ID_PATTERN = /^UW-[A-Za-z0-9._-]{12,116}$/;

export function isProductId(value: unknown): value is ProductId {
  return typeof value === 'string' && productIds.includes(value as ProductId);
}

export function isPaymentOrderStatus(value: unknown): value is PaymentOrderStatus {
  return paymentOrderStatuses.includes(value as PaymentOrderStatus);
}

export function isPaymentOrderId(value: unknown): value is string {
  return typeof value === 'string' && ORDER_ID_PATTERN.test(value);
}

export function isValidIsoDate(value: unknown) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

export function assertPaymentOrderIntent(
  value: unknown,
  expected: { orderId?: string; productId: ProductId }
): PaymentOrderIntent {
  const intent = value as Partial<PaymentOrderIntent> | null;

  if (
    !intent ||
    !isPaymentOrderId(intent.orderId) ||
    (expected.orderId && intent.orderId !== expected.orderId) ||
    intent.productId !== expected.productId ||
    !Number.isSafeInteger(intent.amount) ||
    Number(intent.amount) <= 0 ||
    intent.currency !== 'KRW' ||
    intent.orderStatus !== 'created' ||
    typeof intent.orderClaim !== 'string' ||
    intent.orderClaim.length < 40 ||
    !isValidIsoDate(intent.orderClaimExpiresAt)
  ) {
    throw new Error('결제 주문 인증 서버 응답의 무결성을 확인할 수 없습니다.');
  }

  return intent as PaymentOrderIntent;
}

export function assertConfirmedPayment(
  value: unknown,
  expected: {
    paymentId: string;
    orderId: string;
    productId: ProductId;
    amount: number;
  }
): ConfirmedPayment {
  const confirmed = value as Partial<ConfirmedPayment> | null;
  const entitlement = confirmed?.entitlement as Partial<PaymentEntitlement> | undefined;

  if (
    !confirmed ||
    confirmed.paymentId !== expected.paymentId ||
    confirmed.orderId !== expected.orderId ||
    confirmed.productId !== expected.productId ||
    confirmed.amount !== expected.amount ||
    confirmed.currency !== 'KRW' ||
    confirmed.status !== 'PAID' ||
    confirmed.orderStatus !== 'paid' ||
    typeof confirmed.txId !== 'string' ||
    !confirmed.txId.trim() ||
    !entitlement ||
    typeof entitlement.id !== 'string' ||
    !/^[a-f0-9]{64}$/.test(entitlement.id) ||
    entitlement.status !== 'active' ||
    !isValidIsoDate(entitlement.createdAt) ||
    typeof confirmed.reportAccessToken !== 'string' ||
    confirmed.reportAccessToken.length < 40 ||
    !isValidIsoDate(confirmed.reportAccessTokenExpiresAt)
  ) {
    throw new Error('PortOne 결제 확인 서버 응답의 무결성을 확인할 수 없습니다.');
  }

  return confirmed as ConfirmedPayment;
}
