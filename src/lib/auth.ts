import type { IntakeFormData, ServiceId } from '../api/mockData';
import type { AnalysisRequestPayload } from './analysisPayload';

export type AuthProviderType = 'kakao' | 'demo';
export type PaymentMethodType = 'portone' | 'card' | 'bank';

export interface AuthUser {
  id: string;
  nickname: string;
  email?: string;
  avatar?: string;
  provider: AuthProviderType;
  authToken?: string;
  connectedAt: string;
}

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

const AUTH_STORAGE_KEY = 'unwoldang.auth.user';
const PAYMENT_STORAGE_KEY = 'unwoldang.payment.pending';
const PAYMENT_ENTITLEMENT_STORAGE_KEY = 'unwoldang.payment.entitlements';
const AUTH_STATE_STORAGE_KEY = 'unwoldang.auth.kakao.state';

type AuthStatePayload = {
  provider: 'kakao';
  returnTo: string;
  issuedAt: number;
};

export const readStoredAuthUser = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
};

export const writeStoredAuthUser = (user: AuthUser | null) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (!user) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
};

export const createDemoUser = (nickname = '운월당 회원'): AuthUser => ({
  id: `demo-${Date.now()}`,
  nickname,
  provider: 'demo',
  connectedAt: new Date().toISOString()
});

export const getKakaoRedirectUri = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  const canonicalOrigin = 'https://www.unwoldang.com';
  const overrideOrigin = import.meta.env.VITE_KAKAO_REDIRECT_ORIGIN;
  const origin =
    overrideOrigin ||
    (window.location.hostname.endsWith('.vercel.app')
      ? canonicalOrigin
      : window.location.hostname === '127.0.0.1' && window.location.port === '5173'
        ? 'http://localhost:5173'
        : window.location.origin);

  return `${origin.replace(/\/$/, '')}/auth/kakao/callback`;
};

export const buildHashCallbackLocation = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  const { hash, search, pathname } = window.location;
  const params = new URLSearchParams(search);

  if (
    hash.startsWith('#/auth/kakao/callback') ||
    hash.startsWith('#/payment/portone/callback') ||
    pathname.startsWith('/auth/kakao/callback') ||
    pathname.startsWith('/payment/portone/callback')
  ) {
    return null;
  }

  if (
    params.has('paymentId') ||
    params.has('payment_id') ||
    params.has('txId') ||
    params.has('transactionId') ||
    params.get('payment')?.startsWith('portone-')
  ) {
    return `/payment/portone/callback${search}`;
  }

  if (params.has('code')) {
    return `/auth/kakao/callback${search}`;
  }

  return null;
};

const encodeAuthState = (payload: AuthStatePayload) => encodeURIComponent(JSON.stringify(payload));

const writePendingAuthState = (state: string) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(AUTH_STATE_STORAGE_KEY, state);
};

export const consumePendingAuthState = (state?: string | null) => {
  if (typeof window === 'undefined' || !state) {
    return false;
  }

  const stored = window.sessionStorage.getItem(AUTH_STATE_STORAGE_KEY);
  window.sessionStorage.removeItem(AUTH_STATE_STORAGE_KEY);

  return Boolean(stored && stored === state);
};

export const sanitizeAuthReturnTo = (returnTo?: string | null) => {
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) {
    return '/my';
  }

  if (returnTo.startsWith('/auth/') || returnTo.startsWith('/payment/')) {
    return '/my';
  }

  return returnTo;
};

export const decodeAuthState = (rawState?: string | null): AuthStatePayload | null => {
  if (!rawState) {
    return null;
  }

  try {
    return JSON.parse(decodeURIComponent(rawState)) as AuthStatePayload;
  } catch {
    return null;
  }
};

export const buildKakaoAuthorizeUrl = (returnTo: string) => {
  const clientId = import.meta.env.VITE_KAKAO_REST_API_KEY;

  if (!clientId) {
    return null;
  }

  const redirectUri = getKakaoRedirectUri();
  const state = encodeAuthState({
    provider: 'kakao',
    returnTo: sanitizeAuthReturnTo(returnTo),
    issuedAt: Date.now()
  });
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state
  });
  writePendingAuthState(state);

  return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
};

export const buildLoginRoute = (returnTo: string, shouldAutoStart = false) => {
  const params = new URLSearchParams({
    returnTo: sanitizeAuthReturnTo(returnTo)
  });

  if (shouldAutoStart) {
    params.set('kakao', '1');
  }

  return `/login?${params.toString()}`;
};

export const getKakaoLoginBridgeUrl = (returnTo: string) => {
  if (typeof window === 'undefined') {
    return null;
  }

  const safeReturnTo = sanitizeAuthReturnTo(returnTo);
  const loginRoute = buildLoginRoute(safeReturnTo, true);

  if (window.location.hostname === '127.0.0.1' && window.location.port === '5173') {
    return `${window.location.protocol}//localhost:5173${loginRoute}`;
  }

  if (window.location.hostname.endsWith('.vercel.app')) {
    return `https://www.unwoldang.com${loginRoute}`;
  }

  return null;
};

export const beginKakaoLogin = (returnTo: string) => {
  const bridgeUrl = getKakaoLoginBridgeUrl(returnTo);

  if (bridgeUrl) {
    return {
      ok: true as const,
      url: bridgeUrl
    };
  }

  const authorizeUrl = buildKakaoAuthorizeUrl(returnTo);

  if (!authorizeUrl) {
    return {
      ok: false as const,
      message: '카카오 REST API 키가 설정되지 않았습니다. 관리자에게 문의해 주세요.'
    };
  }

  return {
    ok: true as const,
    url: authorizeUrl
  };
};

export const buildPortOneRedirectUrl = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  return `${window.location.origin}/payment/portone/callback`;
};

export const readPaymentEntitlementReferences = (): PaymentEntitlementReference[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  const raw = window.localStorage.getItem(PAYMENT_ENTITLEMENT_STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      throw new Error('Invalid entitlement reference list.');
    }

    return parsed
      .filter((entry): entry is PaymentEntitlementReference => {
        if (!entry || typeof entry !== 'object') {
          return false;
        }

        const candidate = entry as Record<string, unknown>;
        return (
          typeof candidate.orderId === 'string' &&
          /^UW-[A-Za-z0-9._-]{12,116}$/.test(candidate.orderId) &&
          typeof candidate.productId === 'string' &&
          Boolean(candidate.productId.trim()) &&
          typeof candidate.createdAt === 'string' &&
          Number.isFinite(Date.parse(candidate.createdAt))
        );
      })
      .slice(0, 20);
  } catch {
    window.localStorage.removeItem(PAYMENT_ENTITLEMENT_STORAGE_KEY);
    return [];
  }
};

const rememberPaymentEntitlementReference = (payment: PendingPayment) => {
  const reference: PaymentEntitlementReference = {
    orderId: payment.orderId,
    productId: payment.productId,
    createdAt: payment.createdAt
  };
  const remaining = readPaymentEntitlementReferences().filter((entry) => entry.orderId !== reference.orderId);

  // Persist only the opaque order reference. Claims and bearer tokens remain session-only.
  window.localStorage.setItem(
    PAYMENT_ENTITLEMENT_STORAGE_KEY,
    JSON.stringify([reference, ...remaining].slice(0, 20))
  );
};

export const savePendingPayment = (payment: PendingPayment) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(PAYMENT_STORAGE_KEY, JSON.stringify(payment));
  rememberPaymentEntitlementReference(payment);
};

export const readPendingPayment = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.sessionStorage.getItem(PAYMENT_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as PendingPayment;
  } catch {
    window.sessionStorage.removeItem(PAYMENT_STORAGE_KEY);
    return null;
  }
};

export const clearPendingPayment = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(PAYMENT_STORAGE_KEY);
};

const createSecureRandomPart = () => {
  const cryptoApi = globalThis.crypto;

  if (!cryptoApi || typeof cryptoApi.getRandomValues !== 'function') {
    throw new Error('안전한 결제 식별자를 만들 수 없는 브라우저입니다. 브라우저를 업데이트해 주세요.');
  }

  if (typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID().replace(/-/g, '');
  }

  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
};

export const createOrderId = () => {
  return `UW-${Date.now()}-${createSecureRandomPart()}`;
};

export const createCustomerKey = (userId?: string) => {
  if (typeof window === 'undefined') {
    return `uw.${Date.now()}.${Math.random().toString(36).slice(2, 10)}`;
  }

  const identity = (userId || 'guest').replace(/[^a-zA-Z0-9\-_.=@]/g, '') || 'guest';
  const storageKey = `${PAYMENT_STORAGE_KEY}.customer.${identity}`;
  const stored = window.localStorage.getItem(storageKey);

  if (stored) {
    return stored;
  }

  const randomPart = createSecureRandomPart();
  const created = `uw.${identity}.${randomPart}`.slice(0, 50);
  window.localStorage.setItem(storageKey, created);
  return created;
};

export const getPriceValue = (price: string) => Number(price.replace(/[^\d]/g, '')) || 0;

type PaymentApiAction = 'order' | 'confirm' | 'entitlements' | 'entitlement/renew';

export const getPortOnePaymentApiEndpoint = (confirmEndpoint: string, action: PaymentApiAction) => {
  const normalized = confirmEndpoint.trim();

  if (!normalized || !/\/confirm\/?(?:\?.*)?$/.test(normalized)) {
    throw new Error('PortOne 결제 확인 API 주소가 올바르지 않습니다.');
  }

  return normalized.replace(/\/confirm\/?(?=\?|$)/, `/${action}`);
};

async function readAuthenticatedPaymentResponse<T>(response: Response): Promise<T> {
  const parsed = (await response.json().catch(() => null)) as ({ message?: string } & Partial<T>) | null;

  if (!response.ok) {
    throw new Error(parsed?.message || '결제 권한 처리 중 오류가 발생했습니다.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('결제 권한 서버 응답 형식이 올바르지 않습니다.');
  }

  return parsed as T;
}

function assertPaymentOrderIntentShape(
  value: PaymentOrderIntent,
  expected: { orderId?: string; productId: ServiceId; amount: number }
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
    throw new Error('결제 주문 인증 서버 응답의 무결성을 확인할 수 없습니다.');
  }
}

function assertRenewedEntitlementShape(
  value: RenewedPaymentEntitlement,
  expected: { orderId: string; productId?: ServiceId; amount?: number }
) {
  if (
    value.orderId !== expected.orderId ||
    (expected.productId && value.productId !== expected.productId) ||
    (expected.amount !== undefined && value.amount !== expected.amount) ||
    typeof value.productId !== 'string' ||
    !Number.isSafeInteger(value.amount) ||
    value.amount <= 0 ||
    value.currency !== 'KRW' ||
    typeof value.reportAccessToken !== 'string' ||
    value.reportAccessToken.length < 40 ||
    !Number.isFinite(Date.parse(value.reportAccessTokenExpiresAt || ''))
  ) {
    throw new Error('결제 리포트 권한 서버 응답의 무결성을 확인할 수 없습니다.');
  }
}

export async function requestPaymentOrderIntent(options: {
  confirmEndpoint: string;
  authToken: string;
  orderId?: string;
  productId: ServiceId;
  amount: number;
}) {
  const response = await fetch(getPortOnePaymentApiEndpoint(options.confirmEndpoint, 'order'), {
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
  productId: ServiceId;
  amount: number;
  orderClaim: string;
}) {
  const response = await fetch(getPortOnePaymentApiEndpoint(options.confirmEndpoint, 'confirm'), {
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
    throw new Error('PortOne 결제 확인 서버 응답의 무결성을 확인할 수 없습니다.');
  }

  return confirmed;
}

export async function fetchPaymentEntitlements(confirmEndpoint: string, authToken: string) {
  const response = await fetch(getPortOnePaymentApiEndpoint(confirmEndpoint, 'entitlements'), {
    headers: {
      Authorization: `Bearer ${authToken}`
    }
  });
  const payload = await readAuthenticatedPaymentResponse<{ entitlements: PaymentEntitlement[] }>(response);

  if (!Array.isArray(payload.entitlements)) {
    throw new Error('결제 권한 목록 서버 응답 형식이 올바르지 않습니다.');
  }

  const valid = payload.entitlements.every((entry) => (
    entry &&
    /^UW-[A-Za-z0-9._-]{12,116}$/.test(entry.orderId || '') &&
    typeof entry.productId === 'string' &&
    Number.isSafeInteger(entry.amount) &&
    entry.amount > 0 &&
    entry.currency === 'KRW' &&
    entry.status === 'active' &&
    Number.isFinite(Date.parse(entry.confirmedAt || ''))
  ));

  if (!valid) {
    throw new Error('결제 권한 목록 서버 응답의 무결성을 확인할 수 없습니다.');
  }

  return payload.entitlements;
}

export async function renewPaymentEntitlement(
  confirmEndpoint: string,
  authToken: string,
  orderId: string
) {
  const response = await fetch(getPortOnePaymentApiEndpoint(confirmEndpoint, 'entitlement/renew'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ orderId })
  });

  const renewed = await readAuthenticatedPaymentResponse<RenewedPaymentEntitlement>(response);
  assertRenewedEntitlementShape(renewed, { orderId });
  return renewed;
}
