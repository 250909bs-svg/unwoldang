import { canReadHistoricalReport, getProductById } from '../../products/registry';
import type { ProductId } from '../../products/types';
import { ApiError } from '../../shared/api/errors';
import type {
  ConfirmedPortOnePayment,
  PaymentEntitlement,
  PaymentOrderIntent,
  RenewedPaymentEntitlement
} from './model';

type PaymentApiAction = 'order' | 'confirm' | 'entitlements' | 'entitlement/renew';

const PAYMENT_NETWORK_USER_MESSAGE = '결제 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.';
const PAYMENT_HTTP_USER_MESSAGE = '결제 권한 처리 중 오류가 발생했습니다.';

const contractError = (userMessage: string) => new ApiError({
  code: 'PAYMENT_API_CONTRACT_VIOLATION',
  userMessage
});

async function fetchPaymentApi(input: string, init?: RequestInit) {
  try {
    return await fetch(input, init);
  } catch (cause) {
    throw new ApiError({
      code: 'PAYMENT_API_NETWORK_ERROR',
      userMessage: PAYMENT_NETWORK_USER_MESSAGE,
      cause
    });
  }
}

export const getPortOnePaymentApiEndpoint = (confirmEndpoint: string, action: PaymentApiAction) => {
  const normalized = confirmEndpoint.trim();

  if (!normalized || !/\/confirm\/?(?:\?.*)?$/.test(normalized)) {
    throw new ApiError({
      code: 'PAYMENT_API_ENDPOINT_INVALID',
      userMessage: 'PortOne 결제 확인 API 주소가 올바르지 않습니다.'
    });
  }

  return normalized.replace(/\/confirm\/?(?=\?|$)/, `/${action}`);
};

async function readAuthenticatedPaymentResponse<T>(response: Response): Promise<T> {
  const parsed = (await response.json().catch(() => null)) as ({ message?: string } & Partial<T>) | null;

  if (!response.ok) {
    throw new ApiError({
      code: 'PAYMENT_API_HTTP_ERROR',
      userMessage: PAYMENT_HTTP_USER_MESSAGE,
      status: response.status,
      cause: parsed?.message ? new Error(parsed.message) : undefined
    });
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ApiError({
      code: 'PAYMENT_API_RESPONSE_INVALID',
      userMessage: '결제 권한 서버 응답 형식이 올바르지 않습니다.',
      status: response.status
    });
  }

  return parsed as T;
}

function hasRecoverableProductContract(productId: unknown, amount: unknown): productId is ProductId {
  if (typeof productId !== 'string') {
    return false;
  }

  const product = getProductById(productId);
  return Boolean(
    product &&
      canReadHistoricalReport(product.id) &&
      product.price === amount
  );
}

function assertPaymentOrderIntentShape(
  value: PaymentOrderIntent,
  expected: { orderId?: string; productId: ProductId; amount: number }
) {
  if (
    !/^UW-[A-Za-z0-9._-]{12,116}$/.test(value.orderId || '') ||
    (expected.orderId && value.orderId !== expected.orderId) ||
    value.productId !== expected.productId ||
    value.amount !== expected.amount ||
    value.currency !== 'KRW' ||
    typeof value.orderClaim !== 'string' ||
    value.orderClaim.length < 40 ||
    !Number.isFinite(Date.parse(value.orderClaimExpiresAt || ''))
  ) {
    throw contractError('결제 주문 인증 서버 응답의 무결성을 확인할 수 없습니다.');
  }
}

function assertRenewedEntitlementShape(
  value: RenewedPaymentEntitlement,
  expected: { orderId: string; productId?: ProductId; amount?: number }
) {
  if (
    value.orderId !== expected.orderId ||
    (expected.productId && value.productId !== expected.productId) ||
    (expected.amount !== undefined && value.amount !== expected.amount) ||
    !Number.isSafeInteger(value.amount) ||
    value.amount <= 0 ||
    !hasRecoverableProductContract(value.productId, value.amount) ||
    value.currency !== 'KRW' ||
    typeof value.reportAccessToken !== 'string' ||
    value.reportAccessToken.length < 40 ||
    !Number.isFinite(Date.parse(value.reportAccessTokenExpiresAt || ''))
  ) {
    throw contractError('결제 리포트 권한 서버 응답의 무결성을 확인할 수 없습니다.');
  }
}

export async function requestPaymentOrderIntent(options: {
  confirmEndpoint: string;
  authToken: string;
  orderId?: string;
  productId: ProductId;
  amount: number;
}) {
  const response = await fetchPaymentApi(getPortOnePaymentApiEndpoint(options.confirmEndpoint, 'order'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      orderId: options.orderId,
      productId: options.productId,
      amount: options.amount
    })
  });

  const intent = await readAuthenticatedPaymentResponse<PaymentOrderIntent>(response);
  assertPaymentOrderIntentShape(intent, options);
  return intent;
}

export async function confirmAuthenticatedPortOnePayment(options: {
  confirmEndpoint: string;
  authToken: string;
  paymentId: string;
  txId?: string;
  orderId: string;
  productId: ProductId;
  amount: number;
  orderClaim: string;
}) {
  const response = await fetchPaymentApi(getPortOnePaymentApiEndpoint(options.confirmEndpoint, 'confirm'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      paymentId: options.paymentId,
      txId: options.txId,
      orderId: options.orderId,
      productId: options.productId,
      amount: options.amount,
      orderClaim: options.orderClaim
    })
  });

  const confirmed = await readAuthenticatedPaymentResponse<ConfirmedPortOnePayment>(response);
  assertRenewedEntitlementShape(confirmed, options);

  if (
    confirmed.paymentId !== options.paymentId ||
    typeof confirmed.txId !== 'string' ||
    !confirmed.txId.trim() ||
    typeof confirmed.status !== 'string' ||
    confirmed.status.toUpperCase() !== 'PAID'
  ) {
    throw contractError('PortOne 결제 확인 서버 응답의 무결성을 확인할 수 없습니다.');
  }

  return confirmed;
}

export async function fetchPaymentEntitlements(confirmEndpoint: string, authToken: string) {
  const response = await fetchPaymentApi(getPortOnePaymentApiEndpoint(confirmEndpoint, 'entitlements'), {
    headers: {
      Authorization: `Bearer ${authToken}`
    }
  });
  const payload = await readAuthenticatedPaymentResponse<{ entitlements: PaymentEntitlement[] }>(response);

  if (!Array.isArray(payload.entitlements)) {
    throw new ApiError({
      code: 'PAYMENT_API_RESPONSE_INVALID',
      userMessage: '결제 권한 목록 서버 응답 형식이 올바르지 않습니다.',
      status: response.status
    });
  }

  const valid = payload.entitlements.every((entry) => (
    entry &&
    /^UW-[A-Za-z0-9._-]{12,116}$/.test(entry.orderId || '') &&
    Number.isSafeInteger(entry.amount) &&
    entry.amount > 0 &&
    hasRecoverableProductContract(entry.productId, entry.amount) &&
    entry.currency === 'KRW' &&
    entry.status === 'active' &&
    Number.isFinite(Date.parse(entry.confirmedAt || ''))
  ));

  if (!valid) {
    throw contractError('결제 권한 목록 서버 응답의 무결성을 확인할 수 없습니다.');
  }

  return payload.entitlements;
}

export async function renewPaymentEntitlement(
  confirmEndpoint: string,
  authToken: string,
  orderId: string
) {
  const response = await fetchPaymentApi(
    getPortOnePaymentApiEndpoint(confirmEndpoint, 'entitlement/renew'),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ orderId })
    }
  );

  const renewed = await readAuthenticatedPaymentResponse<RenewedPaymentEntitlement>(response);
  assertRenewedEntitlementShape(renewed, { orderId });
  return renewed;
}
