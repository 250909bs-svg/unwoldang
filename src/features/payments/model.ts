import type { IntakeFormData, ServiceId } from '../../api/mockData';
import type { AnalysisRequestPayload } from '../../lib/analysisPayload';

export type PaymentMethodType = 'portone' | 'card' | 'bank';

export interface PendingPayment {
  orderId: string;
  productId: ServiceId;
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
  productId: ServiceId;
  createdAt: string;
}

export interface PaymentOrderIntent {
  orderId: string;
  productId: ServiceId;
  amount: number;
  currency: 'KRW';
  orderClaim: string;
  orderClaimExpiresAt: string;
}

export interface PaymentEntitlement {
  orderId: string;
  productId: ServiceId;
  amount: number;
  currency: 'KRW';
  confirmedAt: string;
  status: 'active';
}

export interface RenewedPaymentEntitlement {
  orderId: string;
  productId: ServiceId;
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
