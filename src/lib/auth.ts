import type { IntakeFormData, ServiceId } from '../api/mockData';
import type { AnalysisRequestPayload } from './analysisPayload';

export type AuthProviderType = 'kakao' | 'demo';
export type PaymentMethodType = 'toss' | 'card' | 'bank';

export interface AuthUser {
  id: string;
  nickname: string;
  email?: string;
  avatar?: string;
  provider: AuthProviderType;
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
  createdAt: string;
}

const AUTH_STORAGE_KEY = 'unwoldang.auth.user';
const PAYMENT_STORAGE_KEY = 'unwoldang.payment.pending';
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

  const overrideOrigin = import.meta.env.VITE_KAKAO_REDIRECT_ORIGIN;
  const origin =
    overrideOrigin ||
    (window.location.hostname === '127.0.0.1' && window.location.port === '5173'
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
    hash.startsWith('#/payment/toss/callback') ||
    pathname.startsWith('/auth/kakao/callback') ||
    pathname.startsWith('/payment/toss/callback')
  ) {
    return null;
  }

  if (params.has('paymentKey') || params.get('payment')?.startsWith('toss-')) {
    return `/payment/toss/callback${search}`;
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

export const buildTossRedirectUrls = () => {
  if (typeof window === 'undefined') {
    return {
      successUrl: '',
      failUrl: ''
    };
  }

  return {
    successUrl: `${window.location.origin}/payment/toss/callback?payment=toss-success`,
    failUrl: `${window.location.origin}/payment/toss/callback?payment=toss-fail`
  };
};

export const savePendingPayment = (payment: PendingPayment) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(PAYMENT_STORAGE_KEY, JSON.stringify(payment));
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

export const createOrderId = () => {
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `UW-${Date.now()}-${randomPart}`;
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

  const randomPart =
    typeof window.crypto !== 'undefined' && typeof window.crypto.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const created = `uw.${identity}.${randomPart}`.slice(0, 50);
  window.localStorage.setItem(storageKey, created);
  return created;
};

export const getPriceValue = (price: string) => Number(price.replace(/[^\d]/g, '')) || 0;
