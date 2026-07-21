import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { generateGeminiSajuReport, ReportRequestError } from '../../src/lib/server/geminiReportService.ts';
import productManifest from '../../src/products/manifest.json';

const port = Number(process.env.PORT || 8080);
const PORTONE_API_BASE_URL = (process.env.PORTONE_API_BASE_URL || 'https://api.portone.io').replace(/\/$/, '');
const PORTONE_PAYMENT_LEDGER_COLLECTION =
  process.env.PORTONE_PAYMENT_LEDGER_COLLECTION?.trim() || 'portonePaymentConfirmations';
const PORTONE_PRODUCT_PRICES_KRW = Object.freeze({
  'general-signature': 79_000,
  'life-flow': 59_000,
  'concern-reading': 2_900,
  'past-life-goblin': 49_000,
  'love-reading': 49_000,
  'love-reunion': 55_000,
  'match-couple': 69_000,
  'match-destiny': 63_000,
  'marriage-blueprint': 72_000,
  'marriage-timing': 58_000,
  'career-reading': 59_000,
  'money-reading': 59_000
} satisfies Record<string, number>);
const PORTONE_ACTIVE_PRODUCT_IDS = new Set(
  Object.entries(productManifest)
    .filter(([, status]) => status === 'active')
    .map(([productId]) => productId)
);
const KAKAO_TOKEN_ENDPOINT = 'https://kauth.kakao.com/oauth/token';
const KAKAO_USER_ENDPOINT = 'https://kapi.kakao.com/v2/user/me';
const REPORT_ACCESS_TOKEN_TTL_MS = Number(process.env.REPORT_ACCESS_TOKEN_TTL_MS || 30 * 60 * 1000);
const PAYMENT_ORDER_CLAIM_TTL_MS = (() => {
  const configured = Number(process.env.PAYMENT_ORDER_CLAIM_TTL_MS || 2 * 60 * 60 * 1000);

  return Number.isFinite(configured)
    ? Math.min(24 * 60 * 60 * 1000, Math.max(5 * 60 * 1000, configured))
    : 2 * 60 * 60 * 1000;
})();
const REPORT_GENERATION_LOCK_TTL_MS = (() => {
  const configured = Number(process.env.REPORT_GENERATION_LOCK_TTL_MS || 2 * 60 * 1000);

  return Number.isFinite(configured)
    ? Math.min(30 * 60 * 1000, Math.max(60 * 1000, configured))
    : 2 * 60 * 1000;
})();
const REPORT_CACHE_MAX_BYTES = 900_000;
const AUTH_ACCESS_TOKEN_TTL_MS = Number(process.env.AUTH_ACCESS_TOKEN_TTL_MS || 30 * 24 * 60 * 60 * 1000);
const ADMIN_ACCESS_TOKEN_TTL_MS = Number(process.env.ADMIN_ACCESS_TOKEN_TTL_MS || 12 * 60 * 60 * 1000);
const REPORT_RATE_LIMIT_WINDOW_MS = Number(process.env.REPORT_RATE_LIMIT_WINDOW_MS || 60 * 1000);
const REPORT_RATE_LIMIT_MAX = Number(process.env.REPORT_RATE_LIMIT_MAX || 12);
const reportRateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
const FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID?.trim() || '(default)';
const FIRESTORE_ARCHIVE_COLLECTION = process.env.FIRESTORE_ARCHIVE_COLLECTION?.trim() || 'reportArchives';
let googleAccessTokenCache: { token: string; expiresAt: number } | null = null;

type AccessTokenPurpose = 'order' | 'report' | 'user' | 'admin';
type ReportAccessClaims = {
  orderId: string;
  paymentId: string;
  productId: string;
  amount: number;
  userBinding: string;
  entitlementId: string;
};
type PaymentOrderClaims = {
  orderId: string;
  productId: string;
  amount: number;
  userBinding: string;
  version: 1;
  nonce: string;
};

const ACCESS_TOKEN_SECRET_ENV: Record<AccessTokenPurpose, string> = {
  order: 'REPORT_ACCESS_SECRET',
  report: 'REPORT_ACCESS_SECRET',
  user: 'USER_ACCESS_SECRET',
  admin: 'ADMIN_ACCESS_SECRET'
};
const developmentAccessTokenSecrets: Record<AccessTokenPurpose, string> = {
  order: randomBytes(32).toString('base64url'),
  report: randomBytes(32).toString('base64url'),
  user: randomBytes(32).toString('base64url'),
  admin: randomBytes(32).toString('base64url')
};
const ACCESS_TOKEN_CLOCK_SKEW_MS = 60 * 1000;

class PaymentRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'PaymentRequestError';
    this.status = status;
  }
}

class ReportGenerationInProgressError extends ReportRequestError {
  readonly code = 'REPORT_GENERATION_IN_PROGRESS';
  readonly retryAfterSeconds = 3;

  constructor() {
    super(409, 'Report generation is already in progress for this payment.');
    this.name = 'ReportGenerationInProgressError';
  }
}

class KakaoAuthError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'KakaoAuthError';
    this.status = status;
  }
}

function getAllowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS?.trim();

  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function isLocalDevelopmentOrigin(origin: string) {
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);
}

function applySecurityHeaders(res: any) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
}

function applyCors(req: any, res: any) {
  const origin = req.headers.origin;
  const allowedOrigins = getAllowedOrigins();

  if (!origin) {
    return;
  }

  if (!allowedOrigins.length && isLocalDevelopmentOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (allowedOrigins.includes(origin) || isLocalDevelopmentOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJson(res: any, status: number, payload: unknown) {
  res.statusCode = status;
  applySecurityHeaders(res);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function getRequiredString(body: Record<string, unknown>, key: string) {
  const value = body[key];

  if (typeof value !== 'string' || !value.trim()) {
    throw new PaymentRequestError(400, `${key} 값이 올바르지 않습니다.`);
  }

  return value.trim();
}

function getRequiredAmount(body: Record<string, unknown>) {
  const amount = Number(body.amount);

  if (!Number.isInteger(amount) || amount <= 0) {
    throw new PaymentRequestError(400, 'amount 값이 올바르지 않습니다.');
  }

  return amount;
}

function getOptionalString(body: Record<string, unknown>, key: string) {
  const value = body[key];

  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function getClientIp(req: any) {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0]?.trim();

  return forwardedFor || req.socket?.remoteAddress || 'unknown';
}

function enforceReportRateLimit(req: any) {
  const key = getClientIp(req);
  const now = Date.now();
  const bucket = reportRateLimitBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    reportRateLimitBuckets.set(key, {
      count: 1,
      resetAt: now + REPORT_RATE_LIMIT_WINDOW_MS
    });
    return;
  }

  bucket.count += 1;

  if (bucket.count > REPORT_RATE_LIMIT_MAX) {
    throw new ReportRequestError(429, 'AI report request limit exceeded. Please try again shortly.');
  }
}

function isProductionRuntime() {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.K_SERVICE?.trim());
}

function allowsUnverifiedReports() {
  return !isProductionRuntime() && process.env.ALLOW_UNVERIFIED_REPORTS === 'true';
}

function getAccessTokenSecret(purpose: AccessTokenPurpose) {
  const envName = ACCESS_TOKEN_SECRET_ENV[purpose];
  const secret = process.env[envName]?.trim();

  if (secret) {
    return secret;
  }

  if (!isProductionRuntime()) {
    return developmentAccessTokenSecrets[purpose];
  }

  throw new ReportRequestError(503, `${envName} is not configured.`);
}

function toBase64Url(value: string | Buffer) {
  return Buffer.from(value).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string) {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error('Invalid base64url value.');
  }

  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf-8');
}

function signAccessTokenPayload(encodedPayload: string, purpose: AccessTokenPurpose, secret: string) {
  if (!secret.trim()) {
    throw new ReportRequestError(503, 'Access token signing secret is empty.');
  }

  return createHmac('sha256', secret)
    .update(`unwoldang-access-token:v2:${purpose}:${encodedPayload}`)
    .digest('base64url');
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim());
}

function isFiniteInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isSafeInteger(value);
}

function createSignedAccessToken(
  purpose: AccessTokenPurpose,
  subject: string,
  claims: Record<string, unknown>,
  ttlMs: number
) {
  if (!isNonEmptyString(subject)) {
    throw new ReportRequestError(500, 'Access token subject is required.');
  }

  if (!isFiniteInteger(ttlMs) || ttlMs <= 0) {
    throw new ReportRequestError(500, 'Access token TTL is invalid.');
  }

  const reservedClaims = ['purpose', 'sub', 'iat', 'exp', 'nonce'];

  if (reservedClaims.some((claim) => Object.prototype.hasOwnProperty.call(claims, claim))) {
    throw new ReportRequestError(500, 'Reserved access token claim cannot be overridden.');
  }

  const secret = getAccessTokenSecret(purpose);
  const now = Date.now();
  const expiresAt = now + ttlMs;

  if (!isFiniteInteger(now) || !isFiniteInteger(expiresAt)) {
    throw new ReportRequestError(500, 'Access token timestamps are invalid.');
  }

  const encodedPayload = toBase64Url(
    JSON.stringify({
      ...claims,
      purpose,
      sub: subject.trim(),
      iat: now,
      exp: expiresAt,
      nonce: randomBytes(12).toString('hex')
    })
  );
  const signature = signAccessTokenPayload(encodedPayload, purpose, secret);

  return `${encodedPayload}.${signature}`;
}

function verifySignedAccessToken(token: string, expectedPurpose: AccessTokenPurpose) {
  const segments = token.split('.');

  if (segments.length !== 2 || !segments[0] || !segments[1]) {
    throw new ReportRequestError(401, 'Invalid access token.');
  }

  const [encodedPayload, signature] = segments;

  if (!/^[A-Za-z0-9_-]+$/.test(signature)) {
    throw new ReportRequestError(401, 'Invalid access token.');
  }

  const secret = getAccessTokenSecret(expectedPurpose);
  const expectedSignature = signAccessTokenPayload(encodedPayload, expectedPurpose, secret);

  if (!safeEqual(signature, expectedSignature)) {
    throw new ReportRequestError(401, 'Invalid access token.');
  }

  let payload: any;

  try {
    payload = JSON.parse(fromBase64Url(encodedPayload));
  } catch {
    throw new ReportRequestError(401, 'Invalid access token.');
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ReportRequestError(401, 'Invalid access token.');
  }

  if (payload.purpose !== expectedPurpose) {
    throw new ReportRequestError(403, 'Access token purpose does not match this request.');
  }

  if (
    !isNonEmptyString(payload.sub) ||
    !isNonEmptyString(payload.nonce) ||
    !isFiniteInteger(payload.iat) ||
    !isFiniteInteger(payload.exp) ||
    payload.iat <= 0 ||
    payload.exp <= payload.iat
  ) {
    throw new ReportRequestError(401, 'Invalid access token claims.');
  }

  const now = Date.now();

  if (payload.iat > now + ACCESS_TOKEN_CLOCK_SKEW_MS) {
    throw new ReportRequestError(401, 'Access token was issued in the future.');
  }

  if (payload.exp <= now) {
    throw new ReportRequestError(401, 'Access token has expired.');
  }

  return payload;
}

function createUserBinding(userId: string) {
  if (!isNonEmptyString(userId)) {
    throw new ReportRequestError(500, 'Authenticated user identity is required.');
  }

  return createHmac('sha256', getAccessTokenSecret('report'))
    .update(`unwoldang-user-binding:v1:${userId.trim()}`)
    .digest('base64url');
}

function createReportAccessToken(input: {
  userId: string;
  orderId: string;
  paymentId: string;
  productId: string;
  amount: number;
  entitlementId: string;
}) {
  const userBinding = createUserBinding(input.userId);

  return createSignedAccessToken(
    'report',
    userBinding,
    {
      orderId: input.orderId,
      paymentId: input.paymentId,
      productId: input.productId,
      amount: input.amount,
      userBinding,
      entitlementId: input.entitlementId
    },
    REPORT_ACCESS_TOKEN_TTL_MS
  );
}

function createPaymentOrderClaim(input: {
  userId: string;
  orderId: string;
  productId: string;
  amount: number;
}) {
  const userBinding = createUserBinding(input.userId);

  return createSignedAccessToken(
    'order',
    userBinding,
    {
      orderId: input.orderId,
      productId: input.productId,
      amount: input.amount,
      userBinding,
      version: 1
    },
    PAYMENT_ORDER_CLAIM_TTL_MS
  );
}

function getReportBearerToken(req: any, body: Record<string, unknown>) {
  const authorization = String(req.headers.authorization || '');

  if (authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim();
  }

  return getOptionalString(body, 'reportAccessToken');
}

function verifyReportAccessToken(token: string): ReportAccessClaims {
  const payload = verifySignedAccessToken(token, 'report');

  if (
    !isNonEmptyString(payload.orderId) ||
    !isNonEmptyString(payload.paymentId) ||
    !isNonEmptyString(payload.productId) ||
    !isNonEmptyString(payload.userBinding) ||
    !isNonEmptyString(payload.entitlementId) ||
    !isFiniteInteger(payload.amount) ||
    payload.amount <= 0 ||
    payload.sub !== payload.userBinding
  ) {
    throw new ReportRequestError(401, 'Invalid report access token claims.');
  }

  return payload as ReportAccessClaims;
}

function verifyPaymentOrderClaim(token: string, userId: string): PaymentOrderClaims {
  const payload = verifySignedAccessToken(token, 'order');
  const expectedUserBinding = createUserBinding(userId);

  if (
    !isNonEmptyString(payload.orderId) ||
    !isNonEmptyString(payload.productId) ||
    !isNonEmptyString(payload.userBinding) ||
    !isNonEmptyString(payload.nonce) ||
    !isFiniteInteger(payload.amount) ||
    payload.amount <= 0 ||
    payload.version !== 1 ||
    payload.sub !== expectedUserBinding ||
    payload.userBinding !== expectedUserBinding
  ) {
    throw new PaymentRequestError(403, '결제 주문 인증 정보가 로그인 사용자와 일치하지 않습니다.');
  }

  return payload as PaymentOrderClaims;
}

function createAuthAccessToken(user: { id: string; nickname?: string; email?: string }) {
  return createSignedAccessToken(
    'user',
    user.id,
    {
      nickname: user.nickname,
      email: user.email,
      provider: 'kakao'
    },
    AUTH_ACCESS_TOKEN_TTL_MS
  );
}

function getBearerToken(req: any) {
  const authorization = String(req.headers.authorization || '');

  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return '';
  }

  return authorization.slice(7).trim();
}

function verifyUserAccess(req: any) {
  const token = getBearerToken(req);

  if (!token) {
    throw new ReportRequestError(401, 'Login access token is required.');
  }

  const payload = verifySignedAccessToken(token, 'user') as {
    sub?: string;
    nickname?: string;
    email?: string;
    provider?: string;
  };

  if (payload.provider !== 'kakao') {
    throw new ReportRequestError(401, 'Invalid login access token.');
  }

  return {
    userId: String(payload.sub),
    nickname: payload.nickname,
    email: payload.email
  };
}

type AuthenticatedUser = ReturnType<typeof verifyUserAccess>;

function assertPaymentOrderId(orderId: string) {
  if (!/^UW-[A-Za-z0-9._-]{12,116}$/.test(orderId)) {
    throw new PaymentRequestError(400, 'orderId 형식이 올바르지 않습니다.');
  }
}

function getCatalogAmount(productId: string) {
  const amount = PORTONE_PRODUCT_PRICES_KRW[productId as keyof typeof PORTONE_PRODUCT_PRICES_KRW];

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new PaymentRequestError(400, '서버 상품표에서 확인할 수 없는 productId입니다.');
  }

  return amount;
}

function assertProductAvailableForNewOrder(productId: string) {
  if (!PORTONE_ACTIVE_PRODUCT_IDS.has(productId)) {
    throw new PaymentRequestError(409, '현재 신규 판매 중인 상품이 아닙니다.');
  }
}

function createPaymentOrderIntent(user: AuthenticatedUser, body: Record<string, unknown>) {
  const productId = getRequiredString(body, 'productId');
  const amount = getCatalogAmount(productId);
  assertProductAvailableForNewOrder(productId);
  const requestedAmount = body.amount === undefined ? amount : getRequiredAmount(body);
  const orderId =
    getOptionalString(body, 'orderId') || `UW-${Date.now()}-${randomBytes(16).toString('base64url')}`;

  assertPaymentOrderId(orderId);

  if (requestedAmount !== amount) {
    throw new PaymentRequestError(409, '주문 금액이 서버 상품 가격과 일치하지 않습니다.');
  }

  const orderClaim = createPaymentOrderClaim({
    userId: user.userId,
    orderId,
    productId,
    amount
  });

  return {
    orderId,
    productId,
    amount,
    currency: 'KRW',
    orderClaim,
    orderClaimExpiresAt: new Date(Date.now() + PAYMENT_ORDER_CLAIM_TTL_MS).toISOString()
  };
}

function verifyAdminAccess(req: any) {
  const token = getBearerToken(req);

  if (!token) {
    throw new ReportRequestError(401, 'Admin access token is required.');
  }

  const payload = verifySignedAccessToken(token, 'admin') as { sub?: string };

  if (!payload.sub) {
    throw new ReportRequestError(401, 'Invalid admin access token.');
  }

  return payload;
}

function assertReportAccess(req: any, body: Record<string, unknown>): ReportAccessClaims | null {
  if (allowsUnverifiedReports()) {
    return null;
  }

  const token = getReportBearerToken(req, body);

  if (!token) {
    throw new ReportRequestError(401, 'Report access token is required.');
  }

  const payload = verifyReportAccessToken(token);
  const serviceId = getOptionalString(body, 'serviceId');
  const orderId = getOptionalString(body, 'orderId');

  if (!serviceId) {
    throw new ReportRequestError(400, 'serviceId is required for a paid report request.');
  }

  if (serviceId !== payload.productId) {
    throw new ReportRequestError(403, 'Report token does not match this product.');
  }

  if (orderId && orderId !== payload.orderId) {
    throw new ReportRequestError(403, 'Report token does not match this order.');
  }

  return payload;
}

function readNestedNumber(source: any, paths: string[][]) {
  for (const path of paths) {
    const value = path.reduce((current, key) => (current && typeof current === 'object' ? current[key] : undefined), source);
    const normalized = Number(value);

    if (Number.isFinite(normalized)) {
      return normalized;
    }
  }

  return null;
}

function readNestedString(source: any, paths: string[][]) {
  for (const path of paths) {
    const value = path.reduce((current, key) => (current && typeof current === 'object' ? current[key] : undefined), source);

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function getPortOnePaymentPayload(parsed: Record<string, unknown> | null) {
  if (!parsed) {
    return null;
  }

  if (typeof parsed.payment === 'object' && parsed.payment) {
    return parsed.payment as Record<string, unknown>;
  }

  return parsed;
}

async function fetchPortOnePayment(paymentId: string) {
  const accessToken = await requestPortOneAccessToken();

  const response = await fetch(`${PORTONE_API_BASE_URL}/payments/${encodeURIComponent(paymentId)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  const parsed = (await response.json().catch(() => null)) as Record<string, unknown> | null;

  if (!response.ok) {
    const message =
      (typeof parsed?.message === 'string' && parsed.message) ||
      (typeof parsed?.code === 'string' && parsed.code) ||
      'PortOne 결제 내역 조회에 실패했습니다.';
    throw new PaymentRequestError(response.status, message);
  }

  const payment = getPortOnePaymentPayload(parsed);

  if (!payment) {
    throw new PaymentRequestError(502, 'PortOne 결제 내역 응답이 비어 있습니다.');
  }

  return payment;
}

async function requestPortOneAccessToken() {
  const apiSecret = process.env.PORTONE_API_SECRET?.trim();

  if (!apiSecret) {
    throw new PaymentRequestError(500, 'PORTONE_API_SECRET이 서버에 설정되지 않았습니다.');
  }

  const response = await fetch(`${PORTONE_API_BASE_URL}/login/api-secret`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ apiSecret })
  });
  const parsed = (await response.json().catch(() => null)) as Record<string, unknown> | null;

  if (!response.ok || typeof parsed?.accessToken !== 'string') {
    const message =
      (typeof parsed?.message === 'string' && parsed.message) ||
      (typeof parsed?.code === 'string' && parsed.code) ||
      'PortOne access token 발급에 실패했습니다.';
    throw new PaymentRequestError(response.status || 502, message);
  }

  return parsed.accessToken;
}

async function confirmPortOnePayment(user: AuthenticatedUser, body: Record<string, unknown>) {
  const paymentId = getRequiredString(body, 'paymentId');
  const orderId = getRequiredString(body, 'orderId');
  const amount = getRequiredAmount(body);
  const txId = getOptionalString(body, 'txId');
  const productId = getRequiredString(body, 'productId');
  const suppliedOrderClaim = getOptionalString(body, 'orderClaim');
  const catalogAmount = getCatalogAmount(productId);

  assertPaymentOrderId(orderId);

  if (!Number.isSafeInteger(amount) || amount !== catalogAmount) {
    throw new PaymentRequestError(409, '주문 금액이 서버 상품 가격과 일치하지 않습니다.');
  }

  if (paymentId !== orderId) {
    throw new PaymentRequestError(409, '결제 ID와 주문번호가 일치하지 않습니다.');
  }

  const configuredStoreId = process.env.PORTONE_STORE_ID?.trim();

  if (!configuredStoreId) {
    throw new PaymentRequestError(500, 'PORTONE_STORE_ID가 서버에 설정되지 않았습니다.');
  }

  const payment = await fetchPortOnePayment(paymentId);
  const status = String(readNestedString(payment, [['status']]) || '').toUpperCase();
  const portOnePaymentId = readNestedString(payment, [['id']]);
  const storeId = readNestedString(payment, [['storeId']]);
  const currency = readNestedString(payment, [['currency']]);
  const paidAmountValue =
    payment.amount && typeof payment.amount === 'object'
      ? (payment.amount as Record<string, unknown>).total
      : undefined;
  const paidAmount =
    typeof paidAmountValue === 'number' && Number.isSafeInteger(paidAmountValue) ? paidAmountValue : null;
  const portOneTransactionId = readNestedString(payment, [['transactionId']]);
  const rawCustomData = payment.customData;
  let customData: Record<string, unknown> | null = null;

  if (rawCustomData && typeof rawCustomData === 'object' && !Array.isArray(rawCustomData)) {
    customData = rawCustomData as Record<string, unknown>;
  } else if (typeof rawCustomData === 'string' && rawCustomData.trim()) {
    try {
      const parsedCustomData = JSON.parse(rawCustomData) as unknown;
      if (parsedCustomData && typeof parsedCustomData === 'object' && !Array.isArray(parsedCustomData)) {
        customData = parsedCustomData as Record<string, unknown>;
      }
    } catch {
      customData = null;
    }
  }

  const paidProductId =
    typeof customData?.productId === 'string' && customData.productId.trim()
      ? customData.productId.trim()
      : undefined;
  const paidOrderClaim =
    typeof customData?.orderClaim === 'string' && customData.orderClaim.trim()
      ? customData.orderClaim.trim()
      : undefined;

  if (!portOnePaymentId || portOnePaymentId !== paymentId) {
    throw new PaymentRequestError(409, 'PortOne 응답의 결제 ID가 주문 정보와 일치하지 않습니다.');
  }

  if (paidAmount === null || paidAmount !== catalogAmount) {
    throw new PaymentRequestError(409, 'PortOne 결제 금액이 주문 금액과 일치하지 않습니다.');
  }

  if (status !== 'PAID') {
    throw new PaymentRequestError(409, `PortOne 결제가 아직 완료 상태가 아닙니다. 현재 상태: ${status || 'UNKNOWN'}`);
  }

  if (!storeId || configuredStoreId !== storeId) {
    throw new PaymentRequestError(409, 'PortOne 상점 ID가 서버 설정과 일치하지 않습니다.');
  }

  if (currency !== 'KRW') {
    throw new PaymentRequestError(409, 'PortOne 결제 통화가 KRW와 일치하지 않습니다.');
  }

  if (!paidProductId || paidProductId !== productId) {
    throw new PaymentRequestError(409, 'PortOne 결제 상품이 주문 상품과 일치하지 않습니다.');
  }

  if (!paidOrderClaim || (suppliedOrderClaim && suppliedOrderClaim !== paidOrderClaim)) {
    throw new PaymentRequestError(409, 'PortOne 결제의 주문 인증 정보가 확인 요청과 일치하지 않습니다.');
  }

  const orderClaims = verifyPaymentOrderClaim(paidOrderClaim, user.userId);

  if (
    orderClaims.orderId !== orderId ||
    orderClaims.productId !== productId ||
    orderClaims.amount !== catalogAmount
  ) {
    throw new PaymentRequestError(409, '서명된 주문 정보가 PortOne 결제 정보와 일치하지 않습니다.');
  }

  if (!portOneTransactionId || (txId && txId !== portOneTransactionId)) {
    throw new PaymentRequestError(409, 'PortOne 거래 ID가 결제 결과와 일치하지 않습니다.');
  }

  const confirmedAt = new Date().toISOString();
  const { documentId: ledgerDocumentId, path: ledgerPath } = getPaymentLedgerLocation(paymentId);
  const userBinding = createUserBinding(user.userId);
  const orderClaimHash = createHash('sha256').update(paidOrderClaim).digest('hex');

  try {
    await firestoreRequest(
      `/${encodeURIComponent(PORTONE_PAYMENT_LEDGER_COLLECTION)}?documentId=${encodeURIComponent(ledgerDocumentId)}`,
      {
        method: 'POST',
        body: JSON.stringify({
          fields: {
            paymentId: { stringValue: paymentId },
            orderId: { stringValue: orderId },
            productId: { stringValue: productId },
            amount: { integerValue: String(catalogAmount) },
            currency: { stringValue: currency },
            storeId: { stringValue: storeId },
            transactionId: { stringValue: portOneTransactionId },
            confirmedAt: { timestampValue: confirmedAt },
            userId: { stringValue: user.userId },
            userBinding: { stringValue: userBinding },
            entitlementId: { stringValue: ledgerDocumentId },
            orderClaimHash: { stringValue: orderClaimHash },
            entitlementStatus: { stringValue: 'active' },
            entitlementCreatedAt: { timestampValue: confirmedAt }
          }
        })
      }
    );
  } catch (error) {
    if (!(error instanceof ReportRequestError) || error.status !== 409) {
      throw error;
    }

    const existing = await firestoreRequest(ledgerPath);
    const existingAmountValue = existing?.fields?.amount?.integerValue;
    const existingAmount =
      typeof existingAmountValue === 'string' && /^\d+$/.test(existingAmountValue)
        ? Number(existingAmountValue)
        : NaN;
    if (
      readFirestoreString(existing, 'paymentId') !== paymentId ||
      readFirestoreString(existing, 'orderId') !== orderId ||
      readFirestoreString(existing, 'productId') !== productId ||
      existingAmount !== catalogAmount ||
      readFirestoreString(existing, 'currency') !== currency ||
      readFirestoreString(existing, 'storeId') !== storeId ||
      readFirestoreString(existing, 'transactionId') !== portOneTransactionId ||
      readFirestoreString(existing, 'userId') !== user.userId ||
      readFirestoreString(existing, 'userBinding') !== userBinding ||
      readFirestoreString(existing, 'entitlementId') !== ledgerDocumentId ||
      readFirestoreString(existing, 'orderClaimHash') !== orderClaimHash ||
      readFirestoreString(existing, 'entitlementStatus') !== 'active'
    ) {
      throw new PaymentRequestError(409, '이미 확인된 결제 원장과 현재 주문 정보가 일치하지 않습니다.');
    }
  }

  const reportAccessToken = createReportAccessToken({
    userId: user.userId,
    orderId,
    paymentId,
    productId,
    amount: catalogAmount,
    entitlementId: ledgerDocumentId
  });

  return {
    paymentId,
    txId: portOneTransactionId,
    orderId,
    productId,
    amount: catalogAmount,
    currency,
    status,
    method: readNestedString(payment, [['method', 'type'], ['method'], ['payMethod']]),
    approvedAt: readNestedString(payment, [['paidAt'], ['approvedAt']]),
    reportAccessToken,
    reportAccessTokenExpiresAt: new Date(Date.now() + REPORT_ACCESS_TOKEN_TTL_MS).toISOString()
  };
}

async function renewReportEntitlement(user: AuthenticatedUser, body: Record<string, unknown>) {
  const orderId = getRequiredString(body, 'orderId');
  assertPaymentOrderId(orderId);
  const { documentId, path } = getPaymentLedgerLocation(orderId);
  let ledger: any;

  try {
    ledger = await firestoreRequest(path);
  } catch (error) {
    if (error instanceof ReportRequestError && error.status === 404) {
      throw new PaymentRequestError(404, '이 계정에서 복구할 수 있는 결제 권한을 찾지 못했습니다.');
    }

    throw error;
  }

  if (readFirestoreString(ledger, 'userId') !== user.userId) {
    // Do not reveal whether an order belongs to a different account.
    throw new PaymentRequestError(404, '이 계정에서 복구할 수 있는 결제 권한을 찾지 못했습니다.');
  }

  const paymentId = readFirestoreString(ledger, 'paymentId');
  const storedOrderId = readFirestoreString(ledger, 'orderId');
  const productId = readFirestoreString(ledger, 'productId');
  const userBinding = readFirestoreString(ledger, 'userBinding');
  const amount = readFirestoreInteger(ledger, 'amount');

  if (
    paymentId !== orderId ||
    storedOrderId !== orderId ||
    !productId ||
    !Number.isSafeInteger(amount) ||
    amount !== getCatalogAmount(productId) ||
    userBinding !== createUserBinding(user.userId) ||
    readFirestoreString(ledger, 'entitlementId') !== documentId ||
    readFirestoreString(ledger, 'entitlementStatus') !== 'active'
  ) {
    throw new PaymentRequestError(409, '결제 권한 원장의 무결성을 확인할 수 없습니다.');
  }

  const reportAccessToken = createReportAccessToken({
    userId: user.userId,
    orderId,
    paymentId,
    productId,
    amount,
    entitlementId: documentId
  });

  return {
    orderId,
    productId,
    amount,
    currency: readFirestoreString(ledger, 'currency') || 'KRW',
    reportAccessToken,
    reportAccessTokenExpiresAt: new Date(Date.now() + REPORT_ACCESS_TOKEN_TTL_MS).toISOString()
  };
}

async function queryPaymentEntitlements(user: AuthenticatedUser) {
  const rows = await firestoreRequest(':runQuery', {
    method: 'POST',
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: PORTONE_PAYMENT_LEDGER_COLLECTION }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'userId' },
            op: 'EQUAL',
            value: { stringValue: user.userId }
          }
        },
        limit: 100
      }
    })
  });

  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row) => row?.document)
    .filter((document) => {
      const productId = readFirestoreString(document, 'productId');
      const amount = readFirestoreInteger(document, 'amount');

      return (
        readFirestoreString(document, 'userId') === user.userId &&
        readFirestoreString(document, 'userBinding') === createUserBinding(user.userId) &&
        readFirestoreString(document, 'entitlementStatus') === 'active' &&
        Boolean(productId) &&
        Number.isSafeInteger(amount) &&
        PORTONE_PRODUCT_PRICES_KRW[productId as keyof typeof PORTONE_PRODUCT_PRICES_KRW] === amount
      );
    })
    .map((document) => ({
      orderId: readFirestoreString(document, 'orderId'),
      productId: readFirestoreString(document, 'productId'),
      amount: readFirestoreInteger(document, 'amount'),
      currency: readFirestoreString(document, 'currency') || 'KRW',
      confirmedAt: readFirestoreTimestamp(document, 'confirmedAt'),
      status: 'active' as const
    }))
    .filter((entry) => Boolean(entry.orderId))
    .sort((left, right) => Date.parse(right.confirmedAt) - Date.parse(left.confirmedAt));
}

async function exchangeKakaoLogin(body: Record<string, unknown>) {
  const clientId = process.env.KAKAO_REST_API_KEY?.trim();
  const clientSecret = process.env.KAKAO_CLIENT_SECRET?.trim();

  if (!clientId) {
    throw new KakaoAuthError(500, '카카오 REST API 키가 서버에 설정되지 않았습니다.');
  }

  getAccessTokenSecret('user');

  const code = getRequiredString(body, 'code');
  const redirectUri = getRequiredString(body, 'redirectUri');
  const tokenParams = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code
  });

  if (clientSecret) {
    tokenParams.set('client_secret', clientSecret);
  }

  const tokenResponse = await fetch(KAKAO_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
    },
    body: tokenParams
  });
  const tokenPayload = (await tokenResponse.json().catch(() => null)) as Record<string, unknown> | null;

  if (!tokenResponse.ok || typeof tokenPayload?.access_token !== 'string') {
    const message =
      (typeof tokenPayload?.error_description === 'string' && tokenPayload.error_description) ||
      (typeof tokenPayload?.error === 'string' && tokenPayload.error) ||
      '카카오 토큰 발급 요청이 실패했습니다.';
    throw new KakaoAuthError(tokenResponse.status || 502, message);
  }

  const userResponse = await fetch(KAKAO_USER_ENDPOINT, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${tokenPayload.access_token}`
    }
  });
  const userPayload = (await userResponse.json().catch(() => null)) as Record<string, any> | null;

  if (!userResponse.ok || !userPayload) {
    const message =
      (typeof userPayload?.msg === 'string' && userPayload.msg) ||
      (typeof userPayload?.message === 'string' && userPayload.message) ||
      '카카오 사용자 정보 조회가 실패했습니다.';
    throw new KakaoAuthError(userResponse.status || 502, message);
  }

  const user = {
    id: String(userPayload.id || ''),
    nickname: userPayload.properties?.nickname || userPayload.kakao_account?.profile?.nickname || '카카오 회원',
    email: userPayload.kakao_account?.email,
    avatar: userPayload.properties?.profile_image || userPayload.kakao_account?.profile?.profile_image_url
  };

  return {
    user,
    provider: 'kakao',
    authToken: createAuthAccessToken(user),
    connectedAt: new Date().toISOString()
  };
}

async function readJsonBody(req: any) {
  const chunks: Uint8Array[] = [];
  let size = 0;

  for await (const chunk of req) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    chunks.push(buffer);
    size += buffer.length;

    if (size > 1024 * 1024) {
      throw new ReportRequestError(413, '요청 본문이 너무 큽니다.');
    }
  }

  const raw = Buffer.concat(chunks).toString('utf-8').trim();

  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new ReportRequestError(400, 'JSON 본문 형식이 올바르지 않습니다.');
  }
}

function getFirestoreProjectId() {
  return (
    process.env.FIRESTORE_PROJECT_ID?.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    process.env.GCLOUD_PROJECT?.trim() ||
    process.env.GCP_PROJECT?.trim() ||
    ''
  );
}

function assertFirestoreEnabled() {
  const projectId = getFirestoreProjectId();

  if (process.env.ENABLE_FIRESTORE_ARCHIVE !== 'true' || !projectId) {
    throw new ReportRequestError(503, 'Server archive storage is not configured.');
  }

  return projectId;
}

function getArchiveDocumentId(userId: string, archiveId: string) {
  return createHash('sha256').update(`${userId}:${archiveId}`).digest('hex');
}

function getTimestampValue(value?: unknown) {
  const timestamp = typeof value === 'string' ? Date.parse(value) : NaN;

  if (Number.isFinite(timestamp)) {
    return new Date(timestamp).toISOString();
  }

  return new Date().toISOString();
}

function readFirestoreString(document: any, fieldName: string) {
  const value = document?.fields?.[fieldName];

  return typeof value?.stringValue === 'string' ? value.stringValue : '';
}

function parseFirestoreArchive(document: any) {
  const entryJson = readFirestoreString(document, 'entryJson');

  if (!entryJson) {
    return null;
  }

  try {
    return JSON.parse(entryJson);
  } catch {
    return null;
  }
}

async function getGoogleAccessToken() {
  const staticToken = process.env.FIRESTORE_ACCESS_TOKEN?.trim();

  if (staticToken) {
    return staticToken;
  }

  const now = Date.now();

  if (googleAccessTokenCache && googleAccessTokenCache.expiresAt > now + 60 * 1000) {
    return googleAccessTokenCache.token;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
      {
        headers: {
          'Metadata-Flavor': 'Google'
        },
        signal: controller.signal
      }
    );
    const payload = (await response.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null;

    if (!response.ok || !payload?.access_token) {
      throw new ReportRequestError(503, 'Firestore access token could not be issued.');
    }

    googleAccessTokenCache = {
      token: payload.access_token,
      expiresAt: now + Math.max(60, Number(payload.expires_in || 3600) - 60) * 1000
    };

    return googleAccessTokenCache.token;
  } finally {
    clearTimeout(timeout);
  }
}

async function firestoreRequest(path: string, init: any = {}) {
  const projectId = assertFirestoreEnabled();
  const accessToken = await getGoogleAccessToken();
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(
    FIRESTORE_DATABASE_ID
  )}/documents${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });
  const payload = (await response.json().catch(() => null)) as any;

  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || 'Firestore request failed.';
    throw new ReportRequestError(response.status || 502, message);
  }

  return payload;
}

type ReportResponsePayload = Awaited<ReturnType<typeof generateGeminiSajuReport>>;
type ReportGenerationLease = {
  kind: 'acquired';
  inputHash: string;
  ledgerPath: string;
  lockId: string;
  updateTime: string;
};
type ReportGenerationResult =
  | ReportGenerationLease
  | {
      kind: 'cached';
      payload: ReportResponsePayload;
    };

function readFirestoreInteger(document: any, fieldName: string) {
  const value = document?.fields?.[fieldName]?.integerValue;

  return typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : NaN;
}

function readFirestoreTimestamp(document: any, fieldName: string) {
  const value = document?.fields?.[fieldName]?.timestampValue;

  return typeof value === 'string' ? value : '';
}

function getPaymentLedgerLocation(paymentId: string) {
  const documentId = createHash('sha256').update(`portone:${paymentId}`).digest('hex');

  return {
    documentId,
    path: `/${encodeURIComponent(PORTONE_PAYMENT_LEDGER_COLLECTION)}/${documentId}`
  };
}

function canonicalJson(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new ReportRequestError(400, 'Report request contains a non-finite number.');
    }

    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const keys = Object.keys(source).sort();

    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(source[key])}`).join(',')}}`;
  }

  throw new ReportRequestError(400, 'Report request contains an unsupported value.');
}

function getReportInputHash(claims: ReportAccessClaims, reportBody: Record<string, unknown>) {
  const canonicalInput = canonicalJson({
    version: 'unwoldang-report-input-v1',
    paymentId: claims.paymentId,
    orderId: claims.orderId,
    productId: claims.productId,
    amount: claims.amount,
    request: reportBody
  });

  return createHash('sha256').update(canonicalInput).digest('hex');
}

function assertPaymentLedgerMatchesClaims(document: any, claims: ReportAccessClaims) {
  if (
    readFirestoreString(document, 'paymentId') !== claims.paymentId ||
    readFirestoreString(document, 'orderId') !== claims.orderId ||
    readFirestoreString(document, 'productId') !== claims.productId ||
    readFirestoreInteger(document, 'amount') !== claims.amount ||
    readFirestoreString(document, 'userBinding') !== claims.userBinding ||
    readFirestoreString(document, 'entitlementId') !== claims.entitlementId ||
    readFirestoreString(document, 'entitlementStatus') !== 'active'
  ) {
    throw new ReportRequestError(403, 'Report token does not match the confirmed payment ledger.');
  }
}

function assertCompatibleReportInput(document: any, inputHash: string) {
  const storedInputHash = readFirestoreString(document, 'reportInputHash');

  if (storedInputHash && storedInputHash !== inputHash) {
    throw new ReportRequestError(409, 'This payment has already been bound to a different report input.');
  }
}

function parseCompletedReport(document: any, inputHash: string): ReportResponsePayload | null {
  if (readFirestoreString(document, 'reportGenerationStatus') !== 'completed') {
    return null;
  }

  if (readFirestoreString(document, 'reportInputHash') !== inputHash) {
    throw new ReportRequestError(409, 'This payment has already been used for a different report input.');
  }

  const reportJson = readFirestoreString(document, 'reportJson');

  if (!reportJson || Buffer.byteLength(reportJson, 'utf8') > REPORT_CACHE_MAX_BYTES) {
    throw new ReportRequestError(503, 'The saved report cache is unavailable or exceeds its safety limit.');
  }

  const expectedHash = readFirestoreString(document, 'reportJsonHash');
  const actualHash = createHash('sha256').update(reportJson).digest('hex');

  if (!/^[a-f0-9]{64}$/.test(expectedHash) || !safeEqual(expectedHash, actualHash)) {
    throw new ReportRequestError(503, 'The saved report cache failed its integrity check.');
  }

  try {
    const payload = JSON.parse(reportJson) as unknown;

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('Invalid cached report shape.');
    }

    return payload as ReportResponsePayload;
  } catch {
    throw new ReportRequestError(503, 'The saved report cache could not be decoded.');
  }
}

function getFirestorePatchPath(documentPath: string, fieldPaths: string[], updateTime: string) {
  const params = new URLSearchParams();

  fieldPaths.forEach((fieldPath) => params.append('updateMask.fieldPaths', fieldPath));
  params.set('currentDocument.updateTime', updateTime);

  return `${documentPath}?${params.toString()}`;
}

function isFirestorePreconditionError(error: unknown) {
  return (
    error instanceof ReportRequestError &&
    (error.status === 409 ||
      error.status === 412 ||
      (error.status === 400 && /precondition|update.?time|failed_precondition/i.test(error.message)))
  );
}

async function readPaymentLedger(claims: ReportAccessClaims, ledgerPath: string) {
  try {
    const document = await firestoreRequest(ledgerPath);
    assertPaymentLedgerMatchesClaims(document, claims);
    return document;
  } catch (error) {
    if (error instanceof ReportRequestError && error.status === 404) {
      throw new ReportRequestError(403, 'Confirmed payment ledger was not found for this report token.');
    }

    throw error;
  }
}

async function resolveReportGenerationContention(
  claims: ReportAccessClaims,
  ledgerPath: string,
  inputHash: string
): Promise<ReportGenerationResult> {
  const current = await readPaymentLedger(claims, ledgerPath);
  assertCompatibleReportInput(current, inputHash);
  const cached = parseCompletedReport(current, inputHash);

  if (cached) {
    return { kind: 'cached', payload: cached };
  }

  throw new ReportGenerationInProgressError();
}

async function acquireReportGeneration(
  claims: ReportAccessClaims,
  reportBody: Record<string, unknown>
): Promise<ReportGenerationResult> {
  const { path: ledgerPath } = getPaymentLedgerLocation(claims.paymentId);
  const inputHash = getReportInputHash(claims, reportBody);
  const document = await readPaymentLedger(claims, ledgerPath);
  assertCompatibleReportInput(document, inputHash);

  const cached = parseCompletedReport(document, inputHash);

  if (cached) {
    return { kind: 'cached', payload: cached };
  }

  const status = readFirestoreString(document, 'reportGenerationStatus');
  const lockExpiresAt = Date.parse(readFirestoreTimestamp(document, 'reportGenerationLockExpiresAt'));

  if (status === 'generating' && (!Number.isFinite(lockExpiresAt) || lockExpiresAt > Date.now())) {
    throw new ReportGenerationInProgressError();
  }

  if (status && status !== 'generating' && status !== 'failed') {
    throw new ReportRequestError(503, 'The payment ledger contains an invalid report generation state.');
  }

  const currentUpdateTime = typeof document?.updateTime === 'string' ? document.updateTime : '';

  if (!currentUpdateTime) {
    throw new ReportRequestError(503, 'The payment ledger does not expose a concurrency version.');
  }

  const now = Date.now();
  const lockId = randomBytes(18).toString('base64url');
  const lockExpiresAtIso = new Date(now + REPORT_GENERATION_LOCK_TTL_MS).toISOString();
  const startedAt = new Date(now).toISOString();
  const previousAttempt = readFirestoreInteger(document, 'reportGenerationAttempt');
  const attempt = Number.isSafeInteger(previousAttempt) && previousAttempt >= 0 ? previousAttempt + 1 : 1;
  const updateMask = [
    'reportInputHash',
    'reportGenerationStatus',
    'reportGenerationLockId',
    'reportGenerationLockExpiresAt',
    'reportGenerationStartedAt',
    'reportGenerationAttempt',
    'reportGenerationCompletedAt',
    'reportGenerationFailedAt',
    'reportGenerationFailure',
    'reportJson',
    'reportJsonHash'
  ];

  try {
    const acquired = await firestoreRequest(getFirestorePatchPath(ledgerPath, updateMask, currentUpdateTime), {
      method: 'PATCH',
      body: JSON.stringify({
        fields: {
          reportInputHash: { stringValue: inputHash },
          reportGenerationStatus: { stringValue: 'generating' },
          reportGenerationLockId: { stringValue: lockId },
          reportGenerationLockExpiresAt: { timestampValue: lockExpiresAtIso },
          reportGenerationStartedAt: { timestampValue: startedAt },
          reportGenerationAttempt: { integerValue: String(attempt) }
        }
      })
    });
    const acquiredUpdateTime = typeof acquired?.updateTime === 'string' ? acquired.updateTime : '';

    if (!acquiredUpdateTime) {
      throw new ReportRequestError(503, 'The report generation lock has no concurrency version.');
    }

    return {
      kind: 'acquired',
      inputHash,
      ledgerPath,
      lockId,
      updateTime: acquiredUpdateTime
    };
  } catch (error) {
    if (isFirestorePreconditionError(error)) {
      return resolveReportGenerationContention(claims, ledgerPath, inputHash);
    }

    throw error;
  }
}

async function completeReportGeneration(
  claims: ReportAccessClaims,
  lease: ReportGenerationLease,
  payload: ReportResponsePayload
) {
  const reportJson = JSON.stringify(payload);

  if (!reportJson || Buffer.byteLength(reportJson, 'utf8') > REPORT_CACHE_MAX_BYTES) {
    throw new ReportRequestError(413, 'Generated report exceeds the 900 KB persistence safety limit.');
  }

  const completedAt = new Date().toISOString();
  const reportJsonHash = createHash('sha256').update(reportJson).digest('hex');
  const updateMask = [
    'reportGenerationStatus',
    'reportGenerationCompletedAt',
    'reportGenerationLockId',
    'reportGenerationLockExpiresAt',
    'reportGenerationFailedAt',
    'reportGenerationFailure',
    'reportJson',
    'reportJsonHash'
  ];

  try {
    await firestoreRequest(getFirestorePatchPath(lease.ledgerPath, updateMask, lease.updateTime), {
      method: 'PATCH',
      body: JSON.stringify({
        fields: {
          reportGenerationStatus: { stringValue: 'completed' },
          reportGenerationCompletedAt: { timestampValue: completedAt },
          reportJson: { stringValue: reportJson },
          reportJsonHash: { stringValue: reportJsonHash }
        }
      })
    });

    return payload;
  } catch (writeError) {
    try {
      const current = await readPaymentLedger(claims, lease.ledgerPath);
      assertCompatibleReportInput(current, lease.inputHash);
      const cached = parseCompletedReport(current, lease.inputHash);

      if (cached) {
        return cached;
      }
    } catch (readError) {
      console.error('Report cache verification after completion write failed:', readError);
    }

    throw writeError;
  }
}

async function failReportGeneration(lease: ReportGenerationLease, error: unknown) {
  const failedAt = new Date().toISOString();
  const failure =
    error instanceof ReportRequestError
      ? `${error.name}:${error.status}`
      : error instanceof Error
        ? error.name.slice(0, 120)
        : 'UnknownError';
  const updateMask = [
    'reportGenerationStatus',
    'reportGenerationLockId',
    'reportGenerationLockExpiresAt',
    'reportGenerationCompletedAt',
    'reportGenerationFailedAt',
    'reportGenerationFailure',
    'reportJson',
    'reportJsonHash'
  ];

  try {
    await firestoreRequest(getFirestorePatchPath(lease.ledgerPath, updateMask, lease.updateTime), {
      method: 'PATCH',
      body: JSON.stringify({
        fields: {
          reportGenerationStatus: { stringValue: 'failed' },
          reportGenerationLockExpiresAt: { timestampValue: failedAt },
          reportGenerationFailedAt: { timestampValue: failedAt },
          reportGenerationFailure: { stringValue: failure }
        }
      })
    });
  } catch (recoveryError) {
    console.error('Failed to release report generation lock:', recoveryError);
  }
}

async function generateIdempotentPaidReport(
  claims: ReportAccessClaims,
  reportBody: Record<string, unknown>
): Promise<ReportResponsePayload> {
  const generation = await acquireReportGeneration(claims, reportBody);

  if (generation.kind === 'cached') {
    return generation.payload;
  }

  try {
    const payload = await generateGeminiSajuReport(reportBody);

    if (payload.provider === 'deterministic-fallback') {
      await failReportGeneration(
        generation,
        new ReportRequestError(503, 'AI enhancement returned a retryable deterministic fallback.')
      );
      return payload;
    }

    return await completeReportGeneration(claims, generation, payload);
  } catch (error) {
    await failReportGeneration(generation, error);
    throw error;
  }
}

function normalizeArchiveEntry(rawValue: unknown) {
  const raw = rawValue && typeof rawValue === 'object' ? (rawValue as Record<string, any>) : null;

  if (!raw) {
    throw new ReportRequestError(400, 'Archive entry is required.');
  }

  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : '';
  const productId = typeof raw.productId === 'string' && raw.productId.trim() ? raw.productId.trim() : '';
  const reportData = raw.reportData && typeof raw.reportData === 'object' ? raw.reportData : null;

  if (!id || !productId || !reportData) {
    throw new ReportRequestError(400, 'Archive entry is incomplete.');
  }

  return {
    ...raw,
    id,
    productId,
    orderId: typeof raw.orderId === 'string' ? raw.orderId.trim() : undefined,
    customerName: typeof raw.customerName === 'string' && raw.customerName.trim() ? raw.customerName.trim() : '운월당 회원',
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : '운월당 리포트',
    subtitle: typeof raw.subtitle === 'string' ? raw.subtitle.trim() : '',
    createdAt: getTimestampValue(raw.createdAt),
    paymentMethod: typeof raw.paymentMethod === 'string' ? raw.paymentMethod.trim() : undefined
  };
}

function assertArchiveReportToken(entry: Record<string, any>, body: Record<string, unknown>, userId: string) {
  if (process.env.REQUIRE_REPORT_TOKEN_FOR_ARCHIVE === 'false') {
    return;
  }

  const reportToken = getOptionalString(body, 'reportAccessToken');

  if (!reportToken) {
    throw new ReportRequestError(401, 'Report access token is required for archive save.');
  }

  const payload = verifyReportAccessToken(reportToken);

  if (payload.userBinding !== createUserBinding(userId)) {
    throw new ReportRequestError(403, 'Report token does not belong to this login account.');
  }

  if (payload.orderId && entry.orderId && payload.orderId !== entry.orderId) {
    throw new ReportRequestError(403, 'Report token does not match this archive order.');
  }

  if (payload.productId && entry.productId && payload.productId !== entry.productId) {
    throw new ReportRequestError(403, 'Report token does not match this archive product.');
  }
}

async function saveReportArchiveForUser(user: { userId: string }, body: Record<string, unknown>) {
  const entry = normalizeArchiveEntry(body.entry);
  assertArchiveReportToken(entry, body, user.userId);
  const docId = getArchiveDocumentId(user.userId, entry.id);
  const entryJson = JSON.stringify(entry);

  if (entryJson.length > 900_000) {
    throw new ReportRequestError(413, 'Archive entry is too large.');
  }

  await firestoreRequest(`/${encodeURIComponent(FIRESTORE_ARCHIVE_COLLECTION)}/${docId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      fields: {
        userId: { stringValue: user.userId },
        archiveId: { stringValue: entry.id },
        orderId: { stringValue: entry.orderId || '' },
        productId: { stringValue: entry.productId },
        customerName: { stringValue: entry.customerName },
        title: { stringValue: entry.title },
        paymentMethod: { stringValue: entry.paymentMethod || '' },
        createdAt: { timestampValue: entry.createdAt },
        entryJson: { stringValue: entryJson }
      }
    })
  });

  return entry;
}

async function queryReportArchives(whereUserId?: string) {
  const structuredQuery: any = {
    from: [{ collectionId: FIRESTORE_ARCHIVE_COLLECTION }],
    limit: 200
  };

  if (whereUserId) {
    structuredQuery.where = {
      fieldFilter: {
        field: { fieldPath: 'userId' },
        op: 'EQUAL',
        value: { stringValue: whereUserId }
      }
    };
  }

  const rows = await firestoreRequest(':runQuery', {
    method: 'POST',
    body: JSON.stringify({ structuredQuery })
  });

  const entries = Array.isArray(rows)
    ? rows.map((row) => parseFirestoreArchive(row.document)).filter(Boolean)
    : [];

  return entries
    .sort((left: any, right: any) => Date.parse(right.createdAt || '') - Date.parse(left.createdAt || ''))
    .slice(0, 100);
}

async function loginAdmin(body: Record<string, unknown>) {
  const configuredHash = process.env.ADMIN_CREDENTIAL_HASH?.trim();

  if (!configuredHash) {
    throw new ReportRequestError(503, 'ADMIN_CREDENTIAL_HASH is not configured.');
  }

  getAccessTokenSecret('admin');

  const adminId = getRequiredString(body, 'adminId');
  const password = getRequiredString(body, 'password');
  const inputHash = createHash('sha256').update(`${adminId}:${password}`).digest('hex');

  if (!safeEqual(inputHash, configuredHash)) {
    throw new ReportRequestError(401, 'Admin id or password is incorrect.');
  }

  return {
    adminAccessToken: createSignedAccessToken(
      'admin',
      adminId,
      {},
      ADMIN_ACCESS_TOKEN_TTL_MS
    ),
    expiresInMs: ADMIN_ACCESS_TOKEN_TTL_MS
  };
}

const server = createServer(async (req, res) => {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    const geminiConfigured = Boolean(process.env.GEMINI_API_KEY?.trim());
    const reportSecretConfigured = Boolean(process.env.REPORT_ACCESS_SECRET?.trim());
    const userSecretConfigured = Boolean(process.env.USER_ACCESS_SECRET?.trim());
    const firestoreConfigured =
      process.env.ENABLE_FIRESTORE_ARCHIVE === 'true' && Boolean(getFirestoreProjectId());
    const paymentConfigured = Boolean(
      process.env.PORTONE_API_SECRET?.trim() && process.env.PORTONE_STORE_ID?.trim()
    );

    sendJson(res, 200, {
      ok: true,
      service: 'unwoldang-cloudrun-api',
      provider: 'gemini',
      providerConfigured: geminiConfigured,
      readyForAiEnhancement: geminiConfigured,
      readyForReportGeneration: reportSecretConfigured && firestoreConfigured,
      readyForPaymentConfirmation:
        reportSecretConfigured && userSecretConfigured && firestoreConfigured && paymentConfigured,
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (req.method === 'POST' && (url.pathname === '/report' || url.pathname === '/api/report')) {
    try {
      enforceReportRateLimit(req);
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const reportAccess = assertReportAccess(req, body);
      const { reportAccessToken, orderId, ...reportBody } = body;
      void reportAccessToken;
      void orderId;
      const payload = reportAccess
        ? await generateIdempotentPaidReport(reportAccess, reportBody)
        : await generateGeminiSajuReport(reportBody);
      sendJson(res, 200, payload);
    } catch (error) {
      const status = error instanceof ReportRequestError ? error.status : 500;
      const message = error instanceof Error ? error.message : 'Cloud Run 리포트 생성 중 오류가 발생했습니다.';

      if (error instanceof ReportGenerationInProgressError) {
        res.setHeader('Retry-After', String(error.retryAfterSeconds));
        sendJson(res, status, {
          message,
          code: error.code,
          retryAfterSeconds: error.retryAfterSeconds
        });
      } else {
        sendJson(res, status, { message });
      }
    }
    return;
  }

  if (
    req.method === 'POST' &&
    (url.pathname === '/payments/portone/order' || url.pathname === '/api/payments/portone/order')
  ) {
    try {
      const user = verifyUserAccess(req);
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      sendJson(res, 200, createPaymentOrderIntent(user, body));
    } catch (error) {
      const status = error instanceof PaymentRequestError || error instanceof ReportRequestError ? error.status : 500;
      const message = error instanceof Error ? error.message : '결제 주문 인증 정보 발급 중 오류가 발생했습니다.';
      sendJson(res, status, { message });
    }
    return;
  }

  if (
    req.method === 'POST' &&
    (url.pathname === '/payments/portone/confirm' || url.pathname === '/api/payments/portone/confirm')
  ) {
    try {
      const user = verifyUserAccess(req);
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const payload = await confirmPortOnePayment(user, body);
      sendJson(res, 200, payload);
    } catch (error) {
      const status = error instanceof PaymentRequestError || error instanceof ReportRequestError ? error.status : 500;
      const message = error instanceof Error ? error.message : 'PortOne 결제 검증 처리 중 오류가 발생했습니다.';
      sendJson(res, status, { message });
    }
    return;
  }

  if (
    req.method === 'GET' &&
    (url.pathname === '/payments/portone/entitlements' ||
      url.pathname === '/api/payments/portone/entitlements')
  ) {
    try {
      const user = verifyUserAccess(req);
      const entitlements = await queryPaymentEntitlements(user);
      sendJson(res, 200, { entitlements });
    } catch (error) {
      const status = error instanceof PaymentRequestError || error instanceof ReportRequestError ? error.status : 500;
      const message = error instanceof Error ? error.message : '리포트 결제 권한 조회 중 오류가 발생했습니다.';
      sendJson(res, status, { message });
    }
    return;
  }

  if (
    req.method === 'POST' &&
    (url.pathname === '/payments/portone/entitlement/renew' ||
      url.pathname === '/api/payments/portone/entitlement/renew')
  ) {
    try {
      const user = verifyUserAccess(req);
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const payload = await renewReportEntitlement(user, body);
      sendJson(res, 200, payload);
    } catch (error) {
      const status = error instanceof PaymentRequestError || error instanceof ReportRequestError ? error.status : 500;
      const message = error instanceof Error ? error.message : '리포트 결제 권한 복구 중 오류가 발생했습니다.';
      sendJson(res, status, { message });
    }
    return;
  }


  if (
    req.method === 'POST' &&
    (url.pathname === '/auth/kakao/exchange' || url.pathname === '/api/auth/kakao/exchange')
  ) {
    try {
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const payload = await exchangeKakaoLogin(body);
      sendJson(res, 200, payload);
    } catch (error) {
      const status =
        error instanceof KakaoAuthError ||
        error instanceof PaymentRequestError ||
        error instanceof ReportRequestError
          ? error.status
          : 500;
      const message = error instanceof Error ? error.message : '카카오 로그인 처리 중 오류가 발생했습니다.';
      sendJson(res, status, { message });
    }
    return;
  }

  if (req.method === 'GET' && (url.pathname === '/archive/reports' || url.pathname === '/api/archive/reports')) {
    try {
      const user = verifyUserAccess(req);
      const entries = await queryReportArchives(user.userId);
      sendJson(res, 200, {
        entries,
        storage: 'firestore'
      });
    } catch (error) {
      const status = error instanceof ReportRequestError ? error.status : 500;
      const message = error instanceof Error ? error.message : '리포트 보관함 조회 중 오류가 발생했습니다.';
      sendJson(res, status, { message });
    }
    return;
  }

  if (req.method === 'POST' && (url.pathname === '/archive/reports' || url.pathname === '/api/archive/reports')) {
    try {
      const user = verifyUserAccess(req);
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const entry = await saveReportArchiveForUser(user, body);
      sendJson(res, 200, {
        ok: true,
        entry
      });
    } catch (error) {
      const status = error instanceof ReportRequestError ? error.status : 500;
      const message = error instanceof Error ? error.message : '리포트 보관함 저장 중 오류가 발생했습니다.';
      sendJson(res, status, { message });
    }
    return;
  }

  if (req.method === 'POST' && (url.pathname === '/admin/login' || url.pathname === '/api/admin/login')) {
    try {
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const payload = await loginAdmin(body);
      sendJson(res, 200, payload);
    } catch (error) {
      const status = error instanceof ReportRequestError || error instanceof PaymentRequestError ? error.status : 500;
      const message = error instanceof Error ? error.message : '관리자 로그인 처리 중 오류가 발생했습니다.';
      sendJson(res, status, { message });
    }
    return;
  }

  if (req.method === 'GET' && (url.pathname === '/admin/reports' || url.pathname === '/api/admin/reports')) {
    try {
      verifyAdminAccess(req);
      const entries = await queryReportArchives();
      sendJson(res, 200, {
        entries,
        storage: 'firestore'
      });
    } catch (error) {
      const status = error instanceof ReportRequestError ? error.status : 500;
      const message = error instanceof Error ? error.message : '관리자 리포트 조회 중 오류가 발생했습니다.';
      sendJson(res, status, { message });
    }
    return;
  }

  sendJson(res, 404, {
    message: '지원하지 않는 경로입니다.',
    routes: [
      'GET /health',
      'POST /api/report',
      'POST /report',
      'POST /api/payments/portone/order',
      'POST /api/payments/portone/confirm',
      'GET /api/payments/portone/entitlements',
      'POST /api/payments/portone/entitlement/renew',
      'POST /api/auth/kakao/exchange',
      'GET /api/archive/reports',
      'POST /api/archive/reports',
      'POST /api/admin/login',
      'GET /api/admin/reports'
    ]
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`unwoldang-cloudrun-api listening on port ${port}`);
});
