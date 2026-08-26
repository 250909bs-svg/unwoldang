import type { AppConfig } from '../../config/env.ts';
import { PaymentRequestError } from '../../contracts/errors.ts';
import type { PortOnePayment, PortOnePaymentClient } from './portoneClient.ts';

export type PaymentProviderName = 'disabled' | 'hyphen' | 'legacy-portone';

export type PaymentProviderConfig = {
  name: PaymentProviderName;
  configured: boolean;
};

export type PaymentCreateInput = {
  paymentId: string;
  productId: string;
  amount: number;
  currency: string;
  orderName: string;
  metadata?: Record<string, unknown>;
};

export type NormalizedPaymentResult = {
  paymentId: string;
  transactionId: string;
  status: string;
  amount: number | null;
  currency: string;
  merchantId: string;
  productId?: string;
  orderClaim?: string;
  method?: string;
  approvedAt?: string;
};

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  readonly configured: boolean;
  createPayment(input: PaymentCreateInput): Promise<unknown>;
  verifyPayment(paymentId: string): Promise<NormalizedPaymentResult>;
  getPaymentStatus(paymentId: string): Promise<string>;
  cancelPayment(paymentId: string): Promise<unknown>;
  normalizePaymentResult(raw: unknown): NormalizedPaymentResult;
}

function unavailable(provider: PaymentProviderName): never {
  const message = provider === 'hyphen'
    ? '하이픈 결제 연동 계약이 아직 구성되지 않았습니다.'
    : '결제 시스템이 현재 비활성화되어 있습니다.';
  throw new PaymentRequestError(503, message);
}

function readNestedString(source: unknown, paths: string[][]) {
  for (const path of paths) {
    const value = path.reduce<unknown>(
      (current, key) =>
        current && typeof current === 'object'
          ? (current as Record<string, unknown>)[key]
          : undefined,
      source
    );

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function getCustomData(payment: PortOnePayment) {
  const raw = payment.customData;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

function getPaymentPayload(raw: unknown): PortOnePayment {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new PaymentRequestError(502, '결제 provider 응답이 비어 있습니다.');
  }
  const source = raw as Record<string, unknown>;
  return source.payment && typeof source.payment === 'object' && !Array.isArray(source.payment)
    ? source.payment as PortOnePayment
    : source as PortOnePayment;
}

export class DisabledPaymentProvider implements PaymentProvider {
  readonly name = 'disabled' as const;
  readonly configured = false;

  async createPayment(_input: PaymentCreateInput) { return unavailable(this.name); }
  async verifyPayment(_paymentId: string) { return unavailable(this.name); }
  async getPaymentStatus(_paymentId: string) { return unavailable(this.name); }
  async cancelPayment(_paymentId: string) { return unavailable(this.name); }
  normalizePaymentResult(_raw: unknown): NormalizedPaymentResult { return unavailable(this.name); }
}

/** Placeholder only. No Hyphen endpoint or credential schema is assumed until its contract is issued. */
export class HyphenPaymentProvider implements PaymentProvider {
  readonly name = 'hyphen' as const;
  readonly configured = false;

  async createPayment(_input: PaymentCreateInput) { return unavailable(this.name); }
  async verifyPayment(_paymentId: string) { return unavailable(this.name); }
  async getPaymentStatus(_paymentId: string) { return unavailable(this.name); }
  async cancelPayment(_paymentId: string) { return unavailable(this.name); }
  normalizePaymentResult(_raw: unknown): NormalizedPaymentResult { return unavailable(this.name); }
}

export class LegacyPortOnePaymentProvider implements PaymentProvider {
  readonly name = 'legacy-portone' as const;
  readonly configured: boolean;

  constructor(
    private readonly config: Pick<AppConfig['portOne'], 'storeId' | 'apiSecret'>,
    private readonly client: PortOnePaymentClient
  ) {
    this.configured = Boolean(config.storeId.trim() && config.apiSecret.trim());
  }

  createPayment(_input: PaymentCreateInput) {
    return Promise.reject(new PaymentRequestError(501, 'legacy PortOne 결제 생성은 브라우저 adapter를 사용합니다.'));
  }

  async verifyPayment(paymentId: string) {
    return this.normalizePaymentResult(await this.client.fetchPayment(paymentId));
  }

  async getPaymentStatus(paymentId: string) {
    return this.verifyPayment(paymentId).then((payment) => payment.status);
  }

  cancelPayment(_paymentId: string) {
    return Promise.reject(new PaymentRequestError(501, 'legacy PortOne 결제 취소 adapter는 아직 연결되지 않았습니다.'));
  }

  normalizePaymentResult(raw: unknown): NormalizedPaymentResult {
    const payment = getPaymentPayload(raw);
    const customData = getCustomData(payment);
    const amountValue = payment.amount && typeof payment.amount === 'object'
      ? (payment.amount as Record<string, unknown>).total
      : undefined;
    return {
      paymentId: readNestedString(payment, [['id']]) || '',
      transactionId: readNestedString(payment, [['transactionId']]) || '',
      status: (readNestedString(payment, [['status']]) || '').toUpperCase(),
      amount: typeof amountValue === 'number' && Number.isSafeInteger(amountValue) ? amountValue : null,
      currency: readNestedString(payment, [['currency']]) || '',
      merchantId: readNestedString(payment, [['storeId']]) || '',
      productId: typeof customData?.productId === 'string' ? customData.productId.trim() : undefined,
      orderClaim: typeof customData?.orderClaim === 'string' ? customData.orderClaim.trim() : undefined,
      method: readNestedString(payment, [['method', 'type'], ['method'], ['payMethod']]),
      approvedAt: readNestedString(payment, [['paidAt'], ['approvedAt']])
    };
  }
}

export function createPaymentProvider(
  config: AppConfig,
  client: PortOnePaymentClient
): PaymentProvider {
  if (config.payment.provider === 'legacy-portone') {
    return new LegacyPortOnePaymentProvider(config.portOne, client);
  }
  if (config.payment.provider === 'hyphen') {
    return new HyphenPaymentProvider();
  }
  return new DisabledPaymentProvider();
}
