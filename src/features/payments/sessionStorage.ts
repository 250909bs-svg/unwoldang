import {
  isPaymentOrderId,
  isPaymentOrderStatus,
  isProductId,
  isValidIsoDate,
  type PaymentOrderStatus,
  type PaymentSession
} from './contracts';

export const PAYMENT_SESSION_STORAGE_KEY = 'unwoldang.payment.pending';
const LEGACY_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function normalizeSession(value: unknown): PaymentSession | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const session = value as Partial<PaymentSession>;

  if (
    session.schemaVersion !== 1 ||
    typeof session.ownerId !== 'string' ||
    !session.ownerId.trim() ||
    !isPaymentOrderId(session.orderId) ||
    !isProductId(session.productId) ||
    session.paymentMethod !== 'portone' ||
    !Number.isSafeInteger(session.amount) ||
    Number(session.amount) <= 0 ||
    session.currency !== 'KRW' ||
    !isPaymentOrderStatus(session.status) ||
    !isValidIsoDate(session.createdAt) ||
    !isValidIsoDate(session.updatedAt)
  ) {
    return null;
  }

  if (
    (session.orderClaim !== undefined && typeof session.orderClaim !== 'string') ||
    (session.paymentId !== undefined && session.paymentId !== session.orderId) ||
    (session.paymentKey !== undefined && session.paymentKey !== session.orderId) ||
    (session.entitlementStatus !== undefined &&
      session.entitlementStatus !== 'active' &&
      session.entitlementStatus !== 'revoked')
  ) {
    return null;
  }

  if (
    session.status !== 'paid' &&
    (session.reportAccessToken ||
      session.reportAccessTokenExpiresAt ||
      session.entitlementStatus === 'active')
  ) {
    return null;
  }

  return session as PaymentSession;
}

function normalizeLegacySession(value: unknown, ownerId: string): PaymentSession | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const legacy = value as Record<string, unknown>;
  const createdAt = typeof legacy.createdAt === 'string' ? legacy.createdAt : '';
  const createdAtMs = Date.parse(createdAt);
  const now = Date.now();

  if (
    legacy.schemaVersion !== undefined ||
    legacy.ownerId !== undefined ||
    !isPaymentOrderId(legacy.orderId) ||
    !isProductId(legacy.productId) ||
    legacy.paymentMethod !== 'portone' ||
    !Number.isSafeInteger(legacy.amount) ||
    Number(legacy.amount) <= 0 ||
    !Number.isFinite(createdAtMs) ||
    createdAtMs > now + 5 * 60 * 1000 ||
    now - createdAtMs > LEGACY_SESSION_MAX_AGE_MS ||
    typeof legacy.orderClaim !== 'string' ||
    legacy.orderClaim.length < 40 ||
    (legacy.paymentKey !== undefined && legacy.paymentKey !== legacy.orderId) ||
    (legacy.txId !== undefined && typeof legacy.txId !== 'string')
  ) {
    return null;
  }

  return {
    schemaVersion: 1,
    ownerId,
    orderId: legacy.orderId,
    productId: legacy.productId,
    paymentMethod: 'portone',
    amount: Number(legacy.amount),
    currency: 'KRW',
    status: 'pending',
    paymentId: legacy.orderId,
    paymentKey: legacy.paymentKey as string | undefined,
    txId: legacy.txId as string | undefined,
    orderClaim: legacy.orderClaim,
    createdAt,
    updatedAt: new Date(now).toISOString()
  };
}

export function readPaymentSession(ownerId?: string) {
  if (typeof window === 'undefined' || !ownerId) {
    return null;
  }

  const raw = window.sessionStorage.getItem(PAYMENT_SESSION_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const session = normalizeSession(parsed);

    if (session) {
      return session.ownerId === ownerId ? session : null;
    }

    const migrated = normalizeLegacySession(parsed, ownerId);

    if (migrated) {
      window.sessionStorage.setItem(
        PAYMENT_SESSION_STORAGE_KEY,
        JSON.stringify(migrated)
      );
    }

    return migrated;
  } catch {
    return null;
  }
}

export function writePaymentSession(session: PaymentSession) {
  if (typeof window === 'undefined') {
    return;
  }

  const normalized = normalizeSession(session);

  if (!normalized) {
    throw new Error('저장하려는 결제 세션의 무결성을 확인할 수 없습니다.');
  }

  window.sessionStorage.setItem(PAYMENT_SESSION_STORAGE_KEY, JSON.stringify(normalized));
}

export function updatePaymentSession(
  session: PaymentSession,
  status: PaymentOrderStatus,
  patch: Partial<PaymentSession> = {}
) {
  const updated: PaymentSession = {
    ...session,
    ...patch,
    status,
    updatedAt: new Date().toISOString()
  };

  if (status !== 'paid') {
    delete updated.entitlementId;
    delete updated.entitlementStatus;
    delete updated.reportAccessToken;
    delete updated.reportAccessTokenExpiresAt;
  }

  if (status === 'failed' || status === 'cancelled' || status === 'refunded') {
    delete updated.orderClaim;
  }

  writePaymentSession(updated);
  return updated;
}

export function clearPaymentSession() {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(PAYMENT_SESSION_STORAGE_KEY);
  }
}

export function canRetryPaymentConfirmation(session: PaymentSession | null) {
  return Boolean(
    session &&
      session.status === 'pending' &&
      session.paymentId &&
      session.paymentId === session.orderId &&
      session.orderClaim
  );
}
