import {
  API_ERROR_CODE,
  type AdminDataResponse,
  type AdminLoginRequest,
  type AdminLoginResponse,
  type ApiErrorCode,
  type ApiErrorResponse,
  type ConfirmPaymentRequest,
  type ConfirmPaymentResponse,
  type CreateOrderRequest,
  type CreateOrderResponse,
  type EntitlementListResponse,
  type GenerateReportRequest,
  type GenerateReportResponse,
  type KakaoExchangeRequest,
  type KakaoExchangeResponse,
  type RenewEntitlementRequest,
  type RenewEntitlementResponse,
  type ReportArchiveListResponse,
  type SaveReportArchiveRequest,
  type SaveReportArchiveResponse
} from './api.ts';
import { PaymentRequestError } from './errors.ts';
import { assertNoServerSecretKeys } from './privacy.ts';
import {
  PRODUCT_STATUS,
  SERVER_PRODUCT_CATALOG,
  type ProductId,
  type ServerProductCatalog
} from './products.ts';

const ORDER_ID_PATTERN = /^UW-[A-Za-z0-9._-]{12,116}$/;
const API_ERROR_CODES = new Set<string>(Object.values(API_ERROR_CODE));

type UnknownRecord = Record<string, unknown>;

export type ProductSchemaAccess = 'new-order' | 'existing-access';

export type ApiSchemaOptions = Readonly<{
  catalog?: ServerProductCatalog;
}>;

export type ProductSchemaOptions = ApiSchemaOptions & Readonly<{
  access: ProductSchemaAccess;
}>;

export type CompatibleAdminLoginResponse = Omit<AdminLoginResponse, 'expiresInMs'> & {
  expiresInMs?: number;
};

export type CompatibleReportArchiveListResponse = Omit<
  ReportArchiveListResponse,
  'storage'
> & {
  storage?: 'firestore';
};

export type CompatibleAdminDataResponse = Omit<AdminDataResponse, 'storage'> & {
  storage?: 'firestore';
};

export class ApiSchemaError extends PaymentRequestError {
  constructor(
    readonly field: string,
    message = `Invalid API request field: ${field}.`,
    status = 400
  ) {
    super(status, message, {
      code: status === 409 ? API_ERROR_CODE.STATE_CONFLICT : API_ERROR_CODE.REQUEST_INVALID,
      exposeMessage: true
    });
    this.name = 'ApiSchemaError';
  }
}

function fail(field: string, message?: string, status = 400): never {
  throw new ApiSchemaError(field, message, status);
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function requireRecord(value: unknown, field = 'body'): UnknownRecord {
  if (!isRecord(value)) {
    return fail(field);
  }

  return value;
}

function readString(
  value: unknown,
  field: string,
  options?: { min?: number; max?: number; optional?: false }
): string;
function readString(
  value: unknown,
  field: string,
  options: { min?: number; max?: number; optional: true }
): string | undefined;
function readString(
  value: unknown,
  field: string,
  options: { min?: number; max?: number; optional?: boolean } = {}
) {
  if (value === undefined && options.optional) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return fail(field);
  }

  const normalized = value.trim();
  const min = options.min ?? 1;
  const max = options.max ?? 4096;

  if (normalized.length < min || normalized.length > max) {
    return fail(field);
  }

  return normalized;
}

function readPositiveInteger(value: unknown, field: string) {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    return fail(field);
  }

  return value as number;
}

function readOptionalPositiveInteger(value: unknown, field: string) {
  return value === undefined ? undefined : readPositiveInteger(value, field);
}

function readOrderId(value: unknown, field = 'orderId') {
  const orderId = readString(value, field, { max: 119 });

  if (!ORDER_ID_PATTERN.test(orderId)) {
    return fail(field);
  }

  return orderId;
}

function readOptionalOrderId(value: unknown, field = 'orderId') {
  return value === undefined ? undefined : readOrderId(value, field);
}

function readAbsoluteHttpUrl(value: unknown, field: string) {
  const raw = readString(value, field, { max: 2048 });

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return fail(field);
    }
  } catch {
    return fail(field);
  }

  return raw;
}

function isIsoDateTime(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    Number.isFinite(Date.parse(value))
  );
}

function isNonEmptyString(value: unknown, max = 4096): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
}

function hasOnlyKeys(value: UnknownRecord, keys: readonly string[]) {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function getCatalog(options?: ApiSchemaOptions) {
  return options?.catalog ?? SERVER_PRODUCT_CATALOG;
}

export function parseProductIdForApi(
  value: unknown,
  options: ProductSchemaOptions
): ProductId {
  const productId = readString(value, 'productId', { max: 100 });

  if (!Object.prototype.hasOwnProperty.call(SERVER_PRODUCT_CATALOG, productId)) {
    return fail(
      'productId',
      options.access === 'new-order' ? '서버 상품표에서 확인할 수 없는 productId입니다.' : 'The requested product is not registered.'
    );
  }

  const product = getCatalog(options)[productId];
  if (!product || !Number.isSafeInteger(product.amount) || product.amount <= 0) {
    return fail(
      'productId',
      options.access === 'new-order' ? '서버 상품표에서 확인할 수 없는 productId입니다.' : 'The requested product is not registered.'
    );
  }

  const allowed = options.access === 'new-order'
    ? product.status === PRODUCT_STATUS.ACTIVE
    : product.status === PRODUCT_STATUS.ACTIVE || product.status === PRODUCT_STATUS.ARCHIVED;

  if (!allowed) {
    return fail(
      'productId',
      options.access === 'new-order'
        ? '현재 신규 판매 중인 상품이 아닙니다.'
        : 'The requested product is not available for this operation.',
      409
    );
  }

  return productId as ProductId;
}

function productMatchesCatalog(
  productId: unknown,
  amount: unknown,
  access: ProductSchemaAccess,
  options?: ApiSchemaOptions
): productId is ProductId {
  try {
    const parsedProductId = parseProductIdForApi(productId, {
      catalog: options?.catalog,
      access
    });
    const product = getCatalog(options)[parsedProductId];
    return Number.isSafeInteger(amount) && amount === product.amount;
  } catch {
    return false;
  }
}

export function parseKakaoExchangeRequest(value: unknown): KakaoExchangeRequest {
  const body = requireRecord(value);
  return {
    code: readString(body.code, 'code', { max: 4096 }),
    redirectUri: readAbsoluteHttpUrl(body.redirectUri, 'redirectUri')
  };
}

export function assertKakaoExchangeRequest(
  value: unknown
): asserts value is KakaoExchangeRequest {
  void parseKakaoExchangeRequest(value);
}

export function parseCreateOrderRequest(
  value: unknown,
  options?: ApiSchemaOptions
): CreateOrderRequest {
  const body = requireRecord(value);
  const productId = parseProductIdForApi(body.productId, {
    catalog: options?.catalog,
    access: 'new-order'
  });
  const amount = readOptionalPositiveInteger(body.amount, 'amount');
  const orderId = readOptionalOrderId(body.orderId);

  return {
    productId,
    ...(amount === undefined ? {} : { amount }),
    ...(orderId === undefined ? {} : { orderId })
  };
}

export function assertCreateOrderRequest(
  value: unknown,
  options?: ApiSchemaOptions
): asserts value is CreateOrderRequest {
  void parseCreateOrderRequest(value, options);
}

export function parseConfirmPaymentRequest(
  value: unknown,
  options?: ApiSchemaOptions
): ConfirmPaymentRequest {
  const body = requireRecord(value);
  const paymentId = readOrderId(body.paymentId, 'paymentId');
  const orderId = readOrderId(body.orderId);
  const productId = parseProductIdForApi(body.productId, {
    catalog: options?.catalog,
    access: 'existing-access'
  });
  const amount = readPositiveInteger(body.amount, 'amount');
  const txId = readString(body.txId, 'txId', { optional: true, max: 256 });
  const orderClaim = readString(body.orderClaim, 'orderClaim', {
    optional: true,
    max: 8192
  });

  if (paymentId !== orderId) {
    return fail('paymentId', 'paymentId must match orderId.');
  }

  return {
    paymentId,
    orderId,
    productId,
    amount,
    ...(txId === undefined ? {} : { txId }),
    ...(orderClaim === undefined ? {} : { orderClaim })
  };
}

export function assertConfirmPaymentRequest(
  value: unknown,
  options?: ApiSchemaOptions
): asserts value is ConfirmPaymentRequest {
  void parseConfirmPaymentRequest(value, options);
}

export function parseRenewEntitlementRequest(
  value: unknown
): RenewEntitlementRequest {
  const body = requireRecord(value);
  return { orderId: readOrderId(body.orderId) };
}

export function assertRenewEntitlementRequest(
  value: unknown
): asserts value is RenewEntitlementRequest {
  void parseRenewEntitlementRequest(value);
}

export function parseGenerateReportRequest(
  value: unknown,
  options?: ApiSchemaOptions
): GenerateReportRequest {
  const body = requireRecord(value);
  const serviceId = parseProductIdForApi(body.serviceId, {
    catalog: options?.catalog,
    access: 'existing-access'
  });
  const payload = requireRecord(body.payload, 'payload');
  const reportMode = readString(body.reportMode, 'reportMode', {
    optional: true,
    max: 200
  });
  const promptVersion = readString(body.promptVersion, 'promptVersion', {
    optional: true,
    max: 200
  });
  // Verified flows bind the authoritative order in the token; development
  // callers historically used this field as a non-UW correlation value.
  const orderId = readString(body.orderId, 'orderId', { optional: true, max: 128 });
  const reportAccessToken = readString(body.reportAccessToken, 'reportAccessToken', {
    optional: true,
    max: 8192
  });

  return {
    serviceId,
    payload,
    ...(reportMode === undefined ? {} : { reportMode }),
    ...(promptVersion === undefined ? {} : { promptVersion }),
    ...(orderId === undefined ? {} : { orderId }),
    ...(reportAccessToken === undefined ? {} : { reportAccessToken })
  };
}

export function assertGenerateReportRequest(
  value: unknown,
  options?: ApiSchemaOptions
): asserts value is GenerateReportRequest {
  void parseGenerateReportRequest(value, options);
}

export function parseSaveReportArchiveRequest(
  value: unknown,
  options?: ApiSchemaOptions
): SaveReportArchiveRequest {
  const body = requireRecord(value);
  const entry = requireRecord(body.entry, 'entry');
  const archiveId = entry.archiveId ?? entry.id;

  try {
    assertNoServerSecretKeys(entry, 'entry');
  } catch {
    return fail('entry', 'Archive entry contains a forbidden credential field.');
  }

  const id = readString(archiveId, 'entry.archiveId', { max: 256 });
  if (
    entry.id !== undefined &&
    entry.archiveId !== undefined &&
    entry.id !== entry.archiveId
  ) {
    return fail('entry.archiveId');
  }
  const productId = parseProductIdForApi(entry.productId, {
    catalog: options?.catalog,
    access: 'existing-access'
  });
  const orderId = readOptionalOrderId(entry.orderId, 'entry.orderId');
  const reportData = requireRecord(entry.reportData, 'entry.reportData');
  const formData = entry.formData === undefined
    ? undefined
    : requireRecord(entry.formData, 'entry.formData');
  const customerName = readString(entry.customerName, 'entry.customerName', {
    optional: true,
    max: 160
  });
  const title = readString(entry.title, 'entry.title', {
    optional: true,
    max: 300
  });
  const subtitle = readString(entry.subtitle, 'entry.subtitle', {
    optional: true,
    min: 0,
    max: 500
  });
  const createdAt = readString(entry.createdAt, 'entry.createdAt', {
    optional: true,
    max: 64
  });
  if (createdAt !== undefined && !isIsoDateTime(createdAt)) {
    return fail('entry.createdAt');
  }
  const paymentMethod = readString(entry.paymentMethod, 'entry.paymentMethod', {
    optional: true,
    max: 120
  });
  const reportProvider = readString(entry.reportProvider, 'entry.reportProvider', {
    optional: true,
    max: 120
  });
  const reportAccessToken = readString(body.reportAccessToken, 'reportAccessToken', {
    optional: true,
    max: 8192
  });

  return {
    entry: {
      id,
      productId,
      reportData,
      ...(orderId === undefined ? {} : { orderId }),
      ...(customerName === undefined ? {} : { customerName }),
      ...(title === undefined ? {} : { title }),
      ...(subtitle === undefined ? {} : { subtitle }),
      ...(createdAt === undefined ? {} : { createdAt }),
      ...(paymentMethod === undefined ? {} : { paymentMethod }),
      ...(formData === undefined ? {} : { formData }),
      ...(reportProvider === undefined ? {} : { reportProvider })
    },
    ...(reportAccessToken === undefined ? {} : { reportAccessToken })
  };
}

export function assertSaveReportArchiveRequest(
  value: unknown,
  options?: ApiSchemaOptions
): asserts value is SaveReportArchiveRequest {
  void parseSaveReportArchiveRequest(value, options);
}

export function parseAdminLoginRequest(value: unknown): AdminLoginRequest {
  const body = requireRecord(value);
  return {
    adminId: readString(body.adminId, 'adminId', { max: 128 }),
    password: readString(body.password, 'password', { max: 1024 })
  };
}

export function assertAdminLoginRequest(
  value: unknown
): asserts value is AdminLoginRequest {
  void parseAdminLoginRequest(value);
}

export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'code',
      'message',
      'retryAfterSeconds',
      'routes'
    ])
  ) {
    return false;
  }

  return (
    typeof value.code === 'string' &&
    API_ERROR_CODES.has(value.code) &&
    isNonEmptyString(value.message, 1000) &&
    (value.retryAfterSeconds === undefined ||
      (typeof value.retryAfterSeconds === 'number' &&
        Number.isSafeInteger(value.retryAfterSeconds) &&
        value.retryAfterSeconds > 0)) &&
    (value.routes === undefined ||
      (value.code === API_ERROR_CODE.UNSUPPORTED_ROUTE &&
        Array.isArray(value.routes) &&
        value.routes.every((route) => isNonEmptyString(route, 200))))
  );
}

export function assertApiErrorResponse(
  value: unknown
): asserts value is ApiErrorResponse {
  if (!isApiErrorResponse(value)) {
    fail('error', 'Invalid or unsafe API error response.');
  }
}

export function isKakaoExchangeResponse(value: unknown): value is KakaoExchangeResponse {
  if (!isRecord(value) || !isRecord(value.user)) {
    return false;
  }

  return (
    value.provider === 'kakao' &&
    isNonEmptyString(value.authToken, 8192) &&
    isIsoDateTime(value.connectedAt) &&
    isNonEmptyString(value.user.id, 128) &&
    isNonEmptyString(value.user.nickname, 200) &&
    (value.user.email === undefined || isNonEmptyString(value.user.email, 320)) &&
    (value.user.avatar === undefined || isNonEmptyString(value.user.avatar, 2048))
  );
}

export function isCreateOrderResponse(
  value: unknown,
  options?: ApiSchemaOptions
): value is CreateOrderResponse {
  if (!isRecord(value)) {
    return false;
  }

  return (
    ORDER_ID_PATTERN.test(String(value.orderId || '')) &&
    productMatchesCatalog(value.productId, value.amount, 'new-order', options) &&
    value.currency === 'KRW' &&
    isNonEmptyString(value.orderClaim, 8192) &&
    value.orderClaim.trim().length >= 40 &&
    isIsoDateTime(value.orderClaimExpiresAt)
  );
}

export function isConfirmPaymentResponse(
  value: unknown,
  options?: ApiSchemaOptions
): value is ConfirmPaymentResponse {
  if (!isRecord(value)) {
    return false;
  }

  return (
    ORDER_ID_PATTERN.test(String(value.paymentId || '')) &&
    value.paymentId === value.orderId &&
    productMatchesCatalog(value.productId, value.amount, 'existing-access', options) &&
    value.currency === 'KRW' &&
    value.status === 'PAID' &&
    isNonEmptyString(value.txId, 256) &&
    (value.method === undefined || isNonEmptyString(value.method, 100)) &&
    (value.approvedAt === undefined || isIsoDateTime(value.approvedAt)) &&
    isNonEmptyString(value.reportAccessToken, 8192) &&
    value.reportAccessToken.trim().length >= 40 &&
    isIsoDateTime(value.reportAccessTokenExpiresAt)
  );
}

export function isRenewEntitlementResponse(
  value: unknown,
  options?: ApiSchemaOptions
): value is RenewEntitlementResponse {
  if (!isRecord(value)) {
    return false;
  }

  return (
    ORDER_ID_PATTERN.test(String(value.orderId || '')) &&
    productMatchesCatalog(value.productId, value.amount, 'existing-access', options) &&
    value.currency === 'KRW' &&
    isNonEmptyString(value.reportAccessToken, 8192) &&
    value.reportAccessToken.trim().length >= 40 &&
    isIsoDateTime(value.reportAccessTokenExpiresAt)
  );
}

export function isEntitlementListResponse(
  value: unknown,
  options?: ApiSchemaOptions
): value is EntitlementListResponse {
  if (!isRecord(value) || !Array.isArray(value.entitlements)) {
    return false;
  }

  return value.entitlements.every((entry) => (
    isRecord(entry) &&
    ORDER_ID_PATTERN.test(String(entry.orderId || '')) &&
    productMatchesCatalog(entry.productId, entry.amount, 'existing-access', options) &&
    entry.currency === 'KRW' &&
    entry.status === 'active' &&
    isIsoDateTime(entry.confirmedAt)
  ));
}

export function isGenerateReportResponse(value: unknown): value is GenerateReportResponse {
  return isRecord(value) && isNonEmptyString(value.provider, 200);
}

export function isSaveReportArchiveResponse(
  value: unknown
): value is SaveReportArchiveResponse {
  return isRecord(value) && value.ok === true && isRecord(value.entry);
}

export function isReportArchiveListResponse(
  value: unknown
): value is CompatibleReportArchiveListResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.entries) &&
    value.entries.every(isRecord) &&
    (value.storage === undefined || value.storage === 'firestore')
  );
}

export function isAdminLoginResponse(
  value: unknown
): value is CompatibleAdminLoginResponse {
  return (
    isRecord(value) &&
    isNonEmptyString(value.adminAccessToken, 8192) &&
    (value.expiresInMs === undefined ||
      (typeof value.expiresInMs === 'number' &&
        Number.isSafeInteger(value.expiresInMs) &&
        value.expiresInMs > 0))
  );
}

export function isAdminDataResponse(
  value: unknown
): value is CompatibleAdminDataResponse {
  return isReportArchiveListResponse(value);
}

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && API_ERROR_CODES.has(value);
}
