import { createServer } from 'node:http';
import { generateGeminiSajuReport, ReportRequestError } from '../../src/lib/server/geminiReportService.ts';

const port = Number(process.env.PORT || 8080);
const TOSS_CONFIRM_ENDPOINT = 'https://api.tosspayments.com/v1/payments/confirm';
const KAKAO_TOKEN_ENDPOINT = 'https://kauth.kakao.com/oauth/token';
const KAKAO_USER_ENDPOINT = 'https://kapi.kakao.com/v2/user/me';

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

async function confirmTossPayment(body: Record<string, unknown>) {
  const secretKey = process.env.TOSS_SECRET_KEY?.trim();

  if (!secretKey) {
    throw new PaymentRequestError(500, '토스 시크릿 키가 서버에 설정되지 않았습니다.');
  }

  const paymentKey = getRequiredString(body, 'paymentKey');
  const orderId = getRequiredString(body, 'orderId');
  const amount = getRequiredAmount(body);
  const authorization = Buffer.from(`${secretKey}:`).toString('base64');

  const response = await fetch(TOSS_CONFIRM_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authorization}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      paymentKey,
      orderId,
      amount
    })
  });

  const parsed = (await response.json().catch(() => null)) as Record<string, unknown> | null;

  if (!response.ok) {
    const message =
      (typeof parsed?.message === 'string' && parsed.message) ||
      (typeof parsed?.code === 'string' && parsed.code) ||
      '토스 결제 승인 요청이 실패했습니다.';
    throw new PaymentRequestError(response.status, message);
  }

  if (parsed?.orderId !== orderId || Number(parsed?.totalAmount) !== amount) {
    throw new PaymentRequestError(409, '토스 승인 응답의 주문번호 또는 금액이 일치하지 않습니다.');
  }

  return {
    paymentKey,
    orderId,
    amount,
    status: parsed.status,
    method: parsed.method,
    approvedAt: parsed.approvedAt,
    receiptUrl:
      typeof parsed.receipt === 'object' && parsed.receipt && 'url' in parsed.receipt
        ? (parsed.receipt as { url?: string }).url
        : undefined
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
      const body = await readJsonBody(req);
      const payload = await generateGeminiSajuReport(body);
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
    (url.pathname === '/payments/toss/confirm' || url.pathname === '/api/payments/toss/confirm')
  ) {
    try {
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const payload = await confirmTossPayment(body);
      sendJson(res, 200, payload);
    } catch (error) {
      const status = error instanceof PaymentRequestError ? error.status : 500;
      const message = error instanceof Error ? error.message : '토스 결제 승인 처리 중 오류가 발생했습니다.';
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
      'POST /api/payments/toss/confirm',
      'POST /api/auth/kakao/exchange'
    ]
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`unwoldang-cloudrun-api listening on port ${port}`);
});
