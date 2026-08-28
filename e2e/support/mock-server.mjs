import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

const fixture = JSON.parse(await readFile(new URL('../fixtures/mock-api.json', import.meta.url), 'utf8'));
const reportFixtureIds = ['general-signature', 'past-life-goblin', 'love-reading', 'love-reunion', 'match-couple'];
const reportFixtures = Object.fromEntries(await Promise.all(reportFixtureIds.map(async (productId) => {
  const report = JSON.parse(await readFile(new URL(`../fixtures/reports/${productId}.json`, import.meta.url), 'utf8'));
  if (!report || report.serviceId !== productId || !report.title?.includes('[E2E fixture]') || !report.subtitle?.includes('[E2E fixture]') || !Array.isArray(report.sections) || !Array.isArray(report.yearLuck) || !Array.isArray(report.monthLuck)) {
    throw new Error(`INVALID_E2E_REPORT_FIXTURE:${productId}`);
  }
  return [productId, report];
})));
const host = '127.0.0.1';
const port = 42714;
const allowedOrigin = 'http://127.0.0.1:42713';
const orders = new Map();
const confirmations = new Map();
const reportBindings = new Map();
const reportCache = new Map();
const archives = new Map();
let sequence = 0;

const cors = {
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Max-Age': '600',
  Vary: 'Origin',
};

function json(response, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    ...cors,
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    'Content-Type': 'application/json; charset=utf-8',
    ...headers,
  });
  response.end(body);
}

async function bodyOf(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 1024 * 1024) throw new Error('REQUEST_TOO_LARGE');
    chunks.push(chunk);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

function bearer(request) {
  const header = request.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

function ownerOf(request, response) {
  if (bearer(request) !== fixture.tokens.access) {
    json(response, 401, { code: 'AUTH_REQUIRED', message: 'E2E fixture authentication required.' });
    return null;
  }
  return fixture.user;
}

function productOf(productId) {
  return typeof productId === 'string' ? fixture.products[productId] : undefined;
}

function reportToken(order) {
  return `e2e-report-token.${order.orderId}.${order.productId}.fixture-signature-0000000000000000`;
}

function entitlement(order, token) {
  return {
    orderId: order.orderId,
    productId: order.productId,
    amount: order.amount,
    currency: 'KRW',
    reportAccessToken: token,
    reportAccessTokenExpiresAt: '2030-01-01T01:00:00.000Z',
  };
}

function bindReport(owner, order) {
  const token = reportToken(order);
  reportBindings.set(token, { ownerId: owner.id, orderId: order.orderId, productId: order.productId });
  return token;
}

function fixtureReport(productId, orderId) {
  const report = reportFixtures[productId];
  if (!report || typeof orderId !== 'string' || !orderId) {
    throw new Error('INVALID_E2E_REPORT_BINDING');
  }
  return {
    ...structuredClone(report),
    serialNumber: orderId,
    createdAt: fixture.clock,
  };
}

async function handle(request, response) {
  const origin = request.headers.origin;
  if (origin && origin !== allowedOrigin) {
    json(response, 403, { code: 'CORS_ORIGIN_DENIED' });
    return;
  }
  if (request.method === 'OPTIONS') {
    response.writeHead(204, cors);
    response.end();
    return;
  }

  const url = new URL(request.url || '/', `http://${host}:${port}`);
  const route = `${request.method} ${url.pathname}`;

  if (route === 'GET /health' || route === 'GET /api/health') {
    json(response, 200, { ok: true, mode: 'e2e-fixture', service: 'unwoldang-e2e-mock' });
    return;
  }

  if (route === 'POST /api/auth/kakao/exchange') {
    const body = await bodyOf(request);
    if (!body.code || !body.redirectUri) {
      json(response, 400, { code: 'AUTH_INPUT_INVALID' });
      return;
    }
    json(response, 200, {
      authToken: fixture.tokens.access,
      user: { id: fixture.user.id, nickname: fixture.user.name, email: fixture.user.email },
    });
    return;
  }

  if (route === 'POST /api/payments/portone/order') {
    const owner = ownerOf(request, response);
    if (!owner) return;
    const body = await bodyOf(request);
    const product = productOf(body.productId);
    if (!product || product.status !== 'active') {
      json(response, 404, { code: 'PRODUCT_NOT_AVAILABLE' });
      return;
    }
    if (body.amount !== product.amount) {
      json(response, 409, { code: 'PRICE_MISMATCH' });
      return;
    }
    const orderId = body.orderId || `UW-E2E-${body.productId}-${String(++sequence).padStart(4, '0')}`;
    const current = orders.get(orderId);
    if (current && (current.ownerId !== owner.id || current.productId !== body.productId || current.amount !== body.amount)) {
      json(response, 409, { code: 'ORDER_BINDING_MISMATCH' });
      return;
    }
    const order = current || {
      orderId,
      ownerId: owner.id,
      productId: body.productId,
      amount: product.amount,
      orderClaim: `e2e-order-claim.${orderId}.fixture-signature-0000000000000000`,
      confirmedAt: null,
    };
    orders.set(orderId, order);
    json(response, 200, {
      orderId,
      productId: order.productId,
      amount: order.amount,
      currency: 'KRW',
      orderClaim: order.orderClaim,
      orderClaimExpiresAt: '2030-01-01T00:10:00.000Z',
    });
    return;
  }

  if (route === 'POST /api/payments/portone/confirm') {
    const owner = ownerOf(request, response);
    if (!owner) return;
    const body = await bodyOf(request);
    const order = orders.get(body.orderId);
    const product = productOf(body.productId);
    if (!order || order.ownerId !== owner.id || order.productId !== body.productId || order.amount !== body.amount || order.orderClaim !== body.orderClaim) {
      json(response, 409, { code: 'PAYMENT_BINDING_MISMATCH' });
      return;
    }
    if (!product || body.amount !== product.amount) {
      json(response, 409, { code: 'PRICE_MISMATCH' });
      return;
    }
    if (!body.paymentId) {
      json(response, 400, { code: 'PAYMENT_ID_REQUIRED' });
      return;
    }
    const prior = confirmations.get(order.orderId);
    if (prior) {
      json(response, prior.paymentId === body.paymentId ? 200 : 409, prior.paymentId === body.paymentId ? prior : { code: 'PAYMENT_IDEMPOTENCY_CONFLICT' });
      return;
    }
    order.confirmedAt = fixture.clock;
    const confirmed = {
      ...entitlement(order, bindReport(owner, order)),
      paymentId: body.paymentId,
      txId: body.txId || `e2e-tx-${order.orderId}`,
      status: 'PAID',
      method: 'E2E_MOCK',
      approvedAt: fixture.clock,
    };
    confirmations.set(order.orderId, confirmed);
    json(response, 200, confirmed);
    return;
  }

  if (route === 'GET /api/payments/portone/entitlements') {
    const owner = ownerOf(request, response);
    if (!owner) return;
    const entitlements = [...orders.values()]
      .filter((order) => order.ownerId === owner.id && order.confirmedAt)
      .map((order) => ({ orderId: order.orderId, productId: order.productId, amount: order.amount, currency: 'KRW', confirmedAt: order.confirmedAt, status: 'active' }));
    json(response, 200, { entitlements });
    return;
  }

  if (route === 'POST /api/payments/portone/entitlement/renew') {
    const owner = ownerOf(request, response);
    if (!owner) return;
    const body = await bodyOf(request);
    const order = orders.get(body.orderId);
    if (!order || order.ownerId !== owner.id || !order.confirmedAt) {
      json(response, 404, { code: 'ENTITLEMENT_NOT_FOUND' });
      return;
    }
    json(response, 200, entitlement(order, bindReport(owner, order)));
    return;
  }

  if (route === 'POST /api/report') {
    const binding = reportBindings.get(bearer(request));
    if (!binding) {
      json(response, 403, { code: 'REPORT_ACCESS_DENIED' });
      return;
    }
    const body = await bodyOf(request);
    if (body.orderId !== binding.orderId || body.serviceId !== binding.productId) {
      json(response, 403, { code: 'REPORT_BINDING_MISMATCH' });
      return;
    }
    const key = `${binding.orderId}:${binding.productId}`;
    const cached = reportCache.get(key);
    if (cached) {
      json(response, 200, cached, { 'X-E2E-Cache': 'HIT' });
      return;
    }
    const payload = { provider: 'deterministic-fallback', report: fixtureReport(binding.productId, binding.orderId) };
    reportCache.set(key, payload);
    json(response, 200, payload, { 'X-E2E-Cache': 'MISS' });
    return;
  }

  if (route === 'GET /api/archive/reports') {
    const owner = ownerOf(request, response);
    if (!owner) return;
    const entries = archives.get(owner.id) || [];
    json(response, 200, { entries }, { 'X-E2E-Archive-Count': String(entries.length) });
    return;
  }

  if (route === 'POST /api/archive/reports') {
    const owner = ownerOf(request, response);
    if (!owner) return;
    const body = await bodyOf(request);
    const entry = body.entry;
    const binding = reportBindings.get(body.reportAccessToken);
    if (!entry?.id || !entry.orderId || !entry.productId || !binding || binding.ownerId !== owner.id || binding.orderId !== entry.orderId || binding.productId !== entry.productId) {
      json(response, 403, { code: 'ARCHIVE_BINDING_MISMATCH' });
      return;
    }
    const current = archives.get(owner.id) || [];
    const entries = [entry, ...current.filter((item) => item.id !== entry.id)].slice(0, 20);
    archives.set(owner.id, entries);
    json(response, 200, { saved: true, entries });
    return;
  }

  json(response, 404, { code: 'E2E_ROUTE_NOT_FOUND', message: route });
}

const server = createServer((request, response) => {
  handle(request, response).catch((error) => {
    const code = error instanceof SyntaxError ? 'INVALID_JSON' : error?.message === 'REQUEST_TOO_LARGE' ? 'REQUEST_TOO_LARGE' : 'E2E_MOCK_ERROR';
    json(response, code === 'INVALID_JSON' ? 400 : code === 'REQUEST_TOO_LARGE' ? 413 : 500, { code });
  });
});

server.listen(port, host, () => console.log(`[e2e:mock-server] listening on http://${host}:${port}`));
const close = () => server.close(() => process.exit(0));
process.once('SIGINT', close);
process.once('SIGTERM', close);
