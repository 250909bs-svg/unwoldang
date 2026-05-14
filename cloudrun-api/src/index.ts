import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { generateGeminiSajuReport, ReportRequestError } from '../../src/lib/server/geminiReportService.ts';

const port = Number(process.env.PORT || 8080);
const PORTONE_API_BASE_URL = (process.env.PORTONE_API_BASE_URL || 'https://api.portone.io').replace(/\/$/, '');
const KAKAO_TOKEN_ENDPOINT = 'https://kauth.kakao.com/oauth/token';
const KAKAO_USER_ENDPOINT = 'https://kapi.kakao.com/v2/user/me';
const REPORT_ACCESS_TOKEN_TTL_MS = Number(process.env.REPORT_ACCESS_TOKEN_TTL_MS || 30 * 60 * 1000);
const REPORT_RATE_LIMIT_WINDOW_MS = Number(process.env.REPORT_RATE_LIMIT_WINDOW_MS || 60 * 1000);
const REPORT_RATE_LIMIT_MAX = Number(process.env.REPORT_RATE_LIMIT_MAX || 12);
const reportRateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

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

function createReportAccessToken(input: {
  orderId: string;
  paymentId: string;
  productId?: string;
  amount: number;
}) {
  const secret = getReportAccessSecret();
  const now = Date.now();
  const payload = {
    orderId: input.orderId,
    paymentId: input.paymentId,
    productId: input.productId,
    amount: input.amount,
    iat: now,
    exp: now + REPORT_ACCESS_TOKEN_TTL_MS,
    nonce: randomBytes(12).toString('hex')
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signReportTokenPayload(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

function getReportBearerToken(req: any, body: Record<string, unknown>) {
  const authorization = String(req.headers.authorization || '');

  if (authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim();
  }

  return getOptionalString(body, 'reportAccessToken');
}

function verifyReportAccessToken(token: string) {
  const secret = getReportAccessSecret();
  const [encodedPayload, signature] = token.split('.');

  if (!encodedPayload || !signature) {
    throw new ReportRequestError(401, 'Invalid report access token.');
  }

  const expectedSignature = signReportTokenPayload(encodedPayload, secret);

  if (!safeEqual(signature, expectedSignature)) {
    throw new ReportRequestError(401, 'Invalid report access token.');
  }

  let payload: any;

  try {
    payload = JSON.parse(fromBase64Url(encodedPayload));
  } catch {
    throw new ReportRequestError(401, 'Invalid report access token.');
  }

  if (!payload?.exp || Number(payload.exp) < Date.now()) {
    throw new ReportRequestError(401, 'Report access token has expired.');
  }

  return payload as {
    orderId: string;
    paymentId: string;
    productId?: string;
    amount: number;
  };
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

  return {
    user: {
      id: String(userPayload.id || ''),
      nickname: userPayload.properties?.nickname || userPayload.kakao_account?.profile?.nickname || '카카오 회원',
      email: userPayload.kakao_account?.email,
      avatar: userPayload.properties?.profile_image || userPayload.kakao_account?.profile?.profile_image_url
    },
    provider: 'kakao',
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

  sendJson(res, 404, {
    message: '지원하지 않는 경로입니다.',
    routes: [
      'GET /health',
      'POST /api/report',
      'POST /report',
      'POST /api/payments/portone/confirm',
      'POST /api/auth/kakao/exchange'
    ]
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`unwoldang-cloudrun-api listening on port ${port}`);
});
