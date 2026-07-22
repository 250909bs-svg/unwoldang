import type { AuthenticatedUser } from './auth.ts';
import type {
  Entitlement,
  ProductCatalogSnapshot,
  ReportArchive
} from './models.ts';
import type { ProductId } from './products.ts';

export const API_ERROR_CODE = Object.freeze({
  UNSUPPORTED_ROUTE: 'UNSUPPORTED_ROUTE',
  REQUEST_INVALID: 'REQUEST_INVALID',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  ACCESS_DENIED: 'ACCESS_DENIED',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  STATE_CONFLICT: 'STATE_CONFLICT',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATASTORE_UNAVAILABLE: 'DATASTORE_UNAVAILABLE',
  AUTH_PROVIDER_FAILED: 'AUTH_PROVIDER_FAILED',
  PAYMENT_PROVIDER_FAILED: 'PAYMENT_PROVIDER_FAILED',
  REPORT_GENERATION_IN_PROGRESS: 'REPORT_GENERATION_IN_PROGRESS',
  REPORT_INPUT_CONFLICT: 'REPORT_INPUT_CONFLICT',
  REFUND_ENTITLEMENT_POLICY_DECISION_REQUIRED:
    'REFUND_ENTITLEMENT_POLICY_DECISION_REQUIRED'
} as const);

export type ApiErrorCode = (typeof API_ERROR_CODE)[keyof typeof API_ERROR_CODE];

export type ApiErrorResponse = {
  code: ApiErrorCode;
  message: string;
  retryAfterSeconds?: number;
  routes?: readonly string[];
};

export type KakaoExchangeRequest = {
  code: string;
  redirectUri: string;
};

export type KakaoExchangeResponse = {
  user: {
    id: string;
    nickname: string;
    email?: string;
    avatar?: string;
  };
  provider: 'kakao';
  authToken: string;
  connectedAt: string;
};

export type CreateOrderRequest = {
  productId: ProductId;
  amount?: number;
  orderId?: string;
};

export type CreateOrderResponse = {
  orderId: string;
  productId: ProductId;
  amount: number;
  currency: 'KRW';
  orderClaim: string;
  orderClaimExpiresAt: string;
};

export type ConfirmPaymentRequest = {
  paymentId: string;
  orderId: string;
  productId: ProductId;
  amount: number;
  txId?: string;
  orderClaim?: string;
};

export type ConfirmPaymentResponse = {
  paymentId: string;
  txId: string;
  orderId: string;
  productId: ProductId;
  amount: number;
  currency: 'KRW';
  status: 'PAID';
  method?: string;
  approvedAt?: string;
  reportAccessToken: string;
  reportAccessTokenExpiresAt: string;
};

export type EntitlementListItem = Pick<
  Entitlement,
  'orderId' | 'productId'
> & {
  status: 'active';
  amount: number;
  currency: 'KRW';
  confirmedAt: string;
};

export type EntitlementListResponse = {
  entitlements: EntitlementListItem[];
};

export type RenewEntitlementRequest = {
  orderId: string;
};

export type RenewEntitlementResponse = {
  orderId: string;
  productId: ProductId;
  amount: number;
  currency: 'KRW';
  reportAccessToken: string;
  reportAccessTokenExpiresAt: string;
};

export type GenerateReportRequest = {
  serviceId: ProductId;
  payload: Record<string, unknown>;
  reportMode?: string;
  promptVersion?: string;
  orderId?: string;
  reportAccessToken?: string;
};

export type GenerateReportResponse = Record<string, unknown> & {
  provider: string;
};

export type SaveReportArchiveRequest = {
  entry: Record<string, unknown>;
  reportAccessToken?: string;
};

export type SaveReportArchiveResponse = {
  ok: true;
  entry: Record<string, unknown>;
};

export type ReportArchiveListResponse = {
  entries: Array<ReportArchive | Record<string, unknown>>;
  storage: 'firestore';
};

export type AdminLoginRequest = {
  adminId: string;
  password: string;
};

export type AdminLoginResponse = {
  adminAccessToken: string;
  expiresInMs: number;
};

export type AdminDataResponse = ReportArchiveListResponse;

export type HealthResponse = {
  ok: true;
  service: 'unwoldang-cloudrun-api';
  provider: 'gemini';
  providerConfigured: boolean;
  readyForAiEnhancement: boolean;
  readyForReportGeneration: boolean;
  readyForPaymentConfirmation: boolean;
  model: string;
  timestamp: string;
};

export type ApiAuthenticatedUser = AuthenticatedUser;

export const API_CONTRACTS = Object.freeze({
  health: {
    method: 'GET',
    paths: ['/health'],
    auth: 'public',
    successStatus: 200
  },
  reportGeneration: {
    method: 'POST',
    paths: ['/api/report', '/report'],
    auth: 'report',
    successStatus: 200
  },
  orderCreation: {
    method: 'POST',
    paths: ['/api/payments/portone/order', '/payments/portone/order'],
    auth: 'user',
    successStatus: 200
  },
  paymentConfirmation: {
    method: 'POST',
    paths: ['/api/payments/portone/confirm', '/payments/portone/confirm'],
    auth: 'user',
    successStatus: 200
  },
  entitlementList: {
    method: 'GET',
    paths: ['/api/payments/portone/entitlements', '/payments/portone/entitlements'],
    auth: 'user',
    successStatus: 200
  },
  entitlementRenewal: {
    method: 'POST',
    paths: [
      '/api/payments/portone/entitlement/renew',
      '/payments/portone/entitlement/renew'
    ],
    auth: 'user',
    successStatus: 200
  },
  kakaoExchange: {
    method: 'POST',
    paths: ['/api/auth/kakao/exchange', '/auth/kakao/exchange'],
    auth: 'public',
    successStatus: 200
  },
  reportArchiveList: {
    method: 'GET',
    paths: ['/api/archive/reports', '/archive/reports'],
    auth: 'user',
    successStatus: 200
  },
  reportArchiveSave: {
    method: 'POST',
    paths: ['/api/archive/reports', '/archive/reports'],
    auth: 'user+report',
    successStatus: 200
  },
  adminLogin: {
    method: 'POST',
    paths: ['/api/admin/login', '/admin/login'],
    auth: 'public',
    successStatus: 200
  },
  adminData: {
    method: 'GET',
    paths: ['/api/admin/reports', '/admin/reports'],
    auth: 'admin',
    successStatus: 200
  },
  productCatalogSnapshot: {
    method: 'INTERNAL',
    paths: [],
    auth: 'server',
    successStatus: 200
  } satisfies {
    method: 'INTERNAL';
    paths: readonly string[];
    auth: 'server';
    successStatus: number;
    response?: ProductCatalogSnapshot;
  }
} as const);
