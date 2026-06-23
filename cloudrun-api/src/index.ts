import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { generateGeminiSajuReport, ReportRequestError } from '../../src/lib/server/geminiReportService.ts';

const port = Number(process.env.PORT || 8080);
const PORTONE_API_BASE_URL = (process.env.PORTONE_API_BASE_URL || 'https://api.portone.io').replace(/\/$/, '');
const KAKAO_TOKEN_ENDPOINT = 'https://kauth.kakao.com/oauth/token';
const KAKAO_USER_ENDPOINT = 'https://kapi.kakao.com/v2/user/me';
const REPORT_ACCESS_TOKEN_TTL_MS = Number(process.env.REPORT_ACCESS_TOKEN_TTL_MS || 30 * 60 * 1000);
const AUTH_ACCESS_TOKEN_TTL_MS = Number(process.env.AUTH_ACCESS_TOKEN_TTL_MS || 30 * 24 * 60 * 60 * 1000);
const ADMIN_ACCESS_TOKEN_TTL_MS = Number(process.env.ADMIN_ACCESS_TOKEN_TTL_MS || 12 * 60 * 60 * 1000);
const REPORT_RATE_LIMIT_WINDOW_MS = Number(process.env.REPORT_RATE_LIMIT_WINDOW_MS || 60 * 1000);
const REPORT_RATE_LIMIT_MAX = Number(process.env.REPORT_RATE_LIMIT_MAX || 12);
const reportRateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
const FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID?.trim() || '(default)';
const FIRESTORE_ARCHIVE_COLLECTION = process.env.FIRESTORE_ARCHIVE_COLLECTION?.trim() || 'reportArchives';
let googleAccessTokenCache: { token: string; expiresAt: number } | null = null;

class PaymentRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'PaymentRequestError';
    this.status = status;
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

function getReportAccessSecret() {
  const secret = process.env.REPORT_ACCESS_SECRET?.trim();

  if (!secret && process.env.ALLOW_UNVERIFIED_REPORTS !== 'true') {
    throw new ReportRequestError(500, 'REPORT_ACCESS_SECRET is not configured.');
  }

  return secret || '';
}

function toBase64Url(value: string | Buffer) {
  return Buffer.from(value).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf-8');
}

function signReportTokenPayload(encodedPayload: string, secret: string) {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function createSignedAccessToken(payload: Record<string, unknown>, ttlMs: number) {
  const secret = getReportAccessSecret();
  const now = Date.now();
  const encodedPayload = toBase64Url(
    JSON.stringify({
      ...payload,
      iat: now,
      exp: now + ttlMs,
      nonce: randomBytes(12).toString('hex')
    })
  );
  const signature = signReportTokenPayload(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

function verifySignedAccessToken(token: string, expectedPurpose: 'report' | 'user' | 'admin') {
  const secret = getReportAccessSecret();
  const [encodedPayload, signature] = token.split('.');

  if (!encodedPayload || !signature) {
    throw new ReportRequestError(401, 'Invalid access token.');
  }

  const expectedSignature = signReportTokenPayload(encodedPayload, secret);

  if (!safeEqual(signature, expectedSignature)) {
    throw new ReportRequestError(401, 'Invalid access token.');
  }

  let payload: any;

  try {
    payload = JSON.parse(fromBase64Url(encodedPayload));
  } catch {
    throw new ReportRequestError(401, 'Invalid access token.');
  }

  if (!payload?.exp || Number(payload.exp) < Date.now()) {
    throw new ReportRequestError(401, 'Access token has expired.');
  }

  if (payload.purpose && payload.purpose !== expectedPurpose) {
    throw new ReportRequestError(403, 'Access token purpose does not match this request.');
  }

  return payload;
}

function createReportAccessToken(input: {
  orderId: string;
  paymentId: string;
  productId?: string;
  amount: number;
}) {
  return createSignedAccessToken({
    purpose: 'report',
    orderId: input.orderId,
    paymentId: input.paymentId,
    productId: input.productId,
    amount: input.amount
  }, REPORT_ACCESS_TOKEN_TTL_MS);
}

function getReportBearerToken(req: any, body: Record<string, unknown>) {
  const authorization = String(req.headers.authorization || '');

  if (authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim();
  }

  return getOptionalString(body, 'reportAccessToken');
}

function verifyReportAccessToken(token: string) {
  const payload = verifySignedAccessToken(token, 'report');

  return payload as {
    orderId: string;
    paymentId: string;
    productId?: string;
    amount: number;
  };
}

function createAuthAccessToken(user: { id: string; nickname?: string; email?: string }) {
  return createSignedAccessToken(
    {
      purpose: 'user',
      sub: user.id,
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
  };

  if (!payload.sub) {
    throw new ReportRequestError(401, 'Invalid login access token.');
  }

  return {
    userId: String(payload.sub),
    nickname: payload.nickname,
    email: payload.email
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

function assertReportAccess(req: any, body: Record<string, unknown>) {
  if (process.env.ALLOW_UNVERIFIED_REPORTS === 'true') {
    return;
  }

  const token = getReportBearerToken(req, body);

  if (!token) {
    throw new ReportRequestError(401, 'Report access token is required.');
  }

  const payload = verifyReportAccessToken(token);
  const serviceId = getOptionalString(body, 'serviceId');
  const orderId = getOptionalString(body, 'orderId');

  if (serviceId && payload.productId && serviceId !== payload.productId) {
    throw new ReportRequestError(403, 'Report token does not match this product.');
  }

  if (orderId && orderId !== payload.orderId) {
    throw new ReportRequestError(403, 'Report token does not match this order.');
  }
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

async function confirmPortOnePayment(body: Record<string, unknown>) {
  const paymentId = getRequiredString(body, 'paymentId');
  const orderId = getRequiredString(body, 'orderId');
  const amount = getRequiredAmount(body);
  const txId = getOptionalString(body, 'txId');
  const productId = getOptionalString(body, 'productId');
  const payment = await fetchPortOnePayment(paymentId);
  const status = String(readNestedString(payment, [['status']]) || '').toUpperCase();
  const paidAmount = readNestedNumber(payment, [
    ['amount', 'paid'],
    ['amount', 'total'],
    ['paidAmount'],
    ['totalAmount'],
    ['amount']
  ]);
  const portOnePaymentId =
    readNestedString(payment, [['paymentId'], ['id'], ['merchantUid']]) ||
    paymentId;
  const configuredStoreId = process.env.PORTONE_STORE_ID?.trim();
  const storeId = readNestedString(payment, [
    ['storeId'],
    ['store', 'id'],
    ['store', 'storeId']
  ]);

  if (paymentId !== orderId) {
    throw new PaymentRequestError(409, '결제 ID와 주문번호가 일치하지 않습니다.');
  }

  if (portOnePaymentId !== paymentId) {
    throw new PaymentRequestError(409, 'PortOne 응답의 결제 ID가 주문 정보와 일치하지 않습니다.');
  }

  if (paidAmount !== amount) {
    throw new PaymentRequestError(409, 'PortOne 결제 금액이 주문 금액과 일치하지 않습니다.');
  }

  if (status !== 'PAID') {
    throw new PaymentRequestError(409, `PortOne 결제가 아직 완료 상태가 아닙니다. 현재 상태: ${status || 'UNKNOWN'}`);
  }

  if (configuredStoreId && storeId && configuredStoreId !== storeId) {
    throw new PaymentRequestError(409, 'PortOne 상점 ID가 서버 설정과 일치하지 않습니다.');
  }

  return {
    paymentId,
    txId:
      txId ||
      readNestedString(payment, [['txId'], ['transactionId'], ['transactions', '0', 'id']]),
    orderId,
    amount,
    status,
    method: readNestedString(payment, [['method', 'type'], ['method'], ['payMethod']]),
    approvedAt: readNestedString(payment, [['paidAt'], ['approvedAt']]),
    reportAccessToken: createReportAccessToken({
      orderId,
      paymentId,
      productId,
      amount
    })
  };
}

async function exchangeKakaoLogin(body: Record<string, unknown>) {
  const clientId = process.env.KAKAO_REST_API_KEY?.trim();
  const clientSecret = process.env.KAKAO_CLIENT_SECRET?.trim();

  if (!clientId) {
    throw new KakaoAuthError(500, '카카오 REST API 키가 서버에 설정되지 않았습니다.');
  }

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

function assertArchiveReportToken(entry: Record<string, any>, body: Record<string, unknown>) {
  if (process.env.REQUIRE_REPORT_TOKEN_FOR_ARCHIVE === 'false') {
    return;
  }

  const reportToken = getOptionalString(body, 'reportAccessToken');

  if (!reportToken) {
    throw new ReportRequestError(401, 'Report access token is required for archive save.');
  }

  const payload = verifyReportAccessToken(reportToken);

  if (payload.orderId && entry.orderId && payload.orderId !== entry.orderId) {
    throw new ReportRequestError(403, 'Report token does not match this archive order.');
  }

  if (payload.productId && entry.productId && payload.productId !== entry.productId) {
    throw new ReportRequestError(403, 'Report token does not match this archive product.');
  }
}

async function saveReportArchiveForUser(user: { userId: string }, body: Record<string, unknown>) {
  const entry = normalizeArchiveEntry(body.entry);
  assertArchiveReportToken(entry, body);
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

  const adminId = getRequiredString(body, 'adminId');
  const password = getRequiredString(body, 'password');
  const inputHash = createHash('sha256').update(`${adminId}:${password}`).digest('hex');

  if (!safeEqual(inputHash, configuredHash)) {
    throw new ReportRequestError(401, 'Admin id or password is incorrect.');
  }

  return {
    adminAccessToken: createSignedAccessToken(
      {
        purpose: 'admin',
        sub: adminId
      },
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
    sendJson(res, 200, {
      ok: true,
      service: 'unwoldang-cloudrun-api',
      provider: 'gemini',
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (req.method === 'POST' && (url.pathname === '/report' || url.pathname === '/api/report')) {
    try {
      enforceReportRateLimit(req);
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      assertReportAccess(req, body);
      const { reportAccessToken, orderId, ...reportBody } = body;
      void reportAccessToken;
      void orderId;
      const payload = await generateGeminiSajuReport(reportBody);
      sendJson(res, 200, payload);
    } catch (error) {
      const status = error instanceof ReportRequestError ? error.status : 500;
      const message = error instanceof Error ? error.message : 'Cloud Run 리포트 생성 중 오류가 발생했습니다.';
      sendJson(res, status, { message });
    }
    return;
  }

  if (
    req.method === 'POST' &&
    (url.pathname === '/payments/portone/confirm' || url.pathname === '/api/payments/portone/confirm')
  ) {
    try {
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const payload = await confirmPortOnePayment(body);
      sendJson(res, 200, payload);
    } catch (error) {
      const status = error instanceof PaymentRequestError || error instanceof ReportRequestError ? error.status : 500;
      const message = error instanceof Error ? error.message : 'PortOne 결제 검증 처리 중 오류가 발생했습니다.';
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
      const status = error instanceof KakaoAuthError || error instanceof PaymentRequestError ? error.status : 500;
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
      'POST /api/payments/portone/confirm',
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
