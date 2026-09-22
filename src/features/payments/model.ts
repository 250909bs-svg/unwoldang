import type { IntakeFormData } from '../../api/mockData';
import type { AnalysisRequestPayload } from '../../lib/analysisPayload';
import type { ProductId } from '../../products/types';

export type PaymentMethodType = 'portone' | 'card' | 'bank';

export interface PendingPayment {
  orderId: string;
  productId: ProductId;
  paymentMethod: PaymentMethodType;
  amount: number;
  customerKey?: string;
  formData?: Partial<IntakeFormData>;
  analysisPayload?: AnalysisRequestPayload;
  tabOrigin?: string;
  paymentKey?: string;
  txId?: string;
  orderClaim?: string;
  reportAccessToken?: string;
  createdAt: string;
}

export interface PaymentEntitlementReference {
  orderId: string;
  productId: ProductId;
  createdAt: string;
}

export interface PaymentOrderIntent {
  orderId: string;
  productId: ProductId;
  /** 상품 정가. 쿠폰과 무관하다. */
  amount: number;
  /** 실제로 청구할 금액. 서버가 정하며, 쿠폰이 없으면 정가와 같다. */
  payableAmount?: number;
  /** 서버가 계산한 할인액. 화면 표시용이고 결제 금액으로 쓰지 않는다. */
  discount?: number;
  couponCode?: string;
  currency: 'KRW';
  orderClaim: string;
  orderClaimExpiresAt: string;
}

export interface PaymentEntitlement {
  orderId: string;
  productId: ProductId;
  amount: number;
  currency: 'KRW';
  confirmedAt: string;
  status: 'active';
}

export interface RenewedPaymentEntitlement {
  orderId: string;
  productId: ProductId;
  amount: number;
  currency: 'KRW';
  reportAccessToken: string;
  reportAccessTokenExpiresAt: string;
}

export interface ConfirmedPortOnePayment extends RenewedPaymentEntitlement {
  paymentId: string;
  txId: string;
  status: string;
  method?: string;
  approvedAt?: string;
}
