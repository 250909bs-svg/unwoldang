export type RuntimeEnv = Record<string, string | undefined>;

import type { PaymentProviderName } from '../domains/payments/paymentProvider.ts';

export type AppConfig = ReturnType<typeof loadConfig>;

function trimmed(env: RuntimeEnv, name: string) {
  return env[name]?.trim() || '';
}

function numeric(env: RuntimeEnv, name: string, fallback: number) {
  return Number(env[name] || fallback);
}

function boundedGuiyeondoRateMax(env: RuntimeEnv, name: string, fallback: number, minimum: number, maximum: number) {
  const configured = numeric(env, name, fallback);
  return Number.isFinite(configured)
    ? Math.min(maximum, Math.max(minimum, Math.floor(configured)))
    : fallback;
}

function resolvePaymentProvider(env: RuntimeEnv, production: boolean): PaymentProviderName {
  const requested = trimmed(env, 'PAYMENT_PROVIDER');
  if (requested === 'disabled' || requested === 'hyphen' || requested === 'legacy-portone') {
    return requested;
  }
  return production ? 'disabled' : 'legacy-portone';
}

export function loadConfig(env: RuntimeEnv = process.env) {
  const production = env.NODE_ENV === 'production' || Boolean(trimmed(env, 'K_SERVICE'));
  const paymentProvider = resolvePaymentProvider(env, production);
  const configuredOrderClaimTtl = numeric(env, 'PAYMENT_ORDER_CLAIM_TTL_MS', 2 * 60 * 60 * 1000);
  const configuredGenerationLockTtl = numeric(env, 'REPORT_GENERATION_LOCK_TTL_MS', 2 * 60 * 1000);
  const configuredAdminRateWindow = numeric(env, 'ADMIN_LOGIN_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000);
  const configuredAdminRateMax = numeric(env, 'ADMIN_LOGIN_RATE_LIMIT_MAX', 5);
  const configuredGuiyeondoTtl = numeric(env, 'GUIYEONDO_INVITE_TTL_MS', 14 * 24 * 60 * 60 * 1000);
  const configuredGuiyeondoRateWindow = numeric(env, 'GUIYEONDO_RATE_LIMIT_WINDOW_MS', 60 * 1000);
  const legacyKasiKey = trimmed(env, 'KASI_SERVICE_KEY')
    || trimmed(env, 'DATA_GO_KR_SERVICE_KEY')
    || trimmed(env, 'PUBLIC_DATA_SERVICE_KEY');
  const lunarKasiKey = trimmed(env, 'KASI_LUNAR_SERVICE_KEY') || legacyKasiKey;
  const specialDayKasiKey = trimmed(env, 'KASI_SPECIALDAY_SERVICE_KEY') || legacyKasiKey;

  return {
    port: numeric(env, 'PORT', 8080),
    production,
    allowedOrigins: trimmed(env, 'ALLOWED_ORIGINS')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    report: {
      allowUnverified: !production && env.ALLOW_UNVERIFIED_REPORTS === 'true',
      accessTokenTtlMs: numeric(env, 'REPORT_ACCESS_TOKEN_TTL_MS', 30 * 60 * 1000),
      orderClaimTtlMs: Number.isFinite(configuredOrderClaimTtl)
        ? Math.min(24 * 60 * 60 * 1000, Math.max(5 * 60 * 1000, configuredOrderClaimTtl))
        : 2 * 60 * 60 * 1000,
      generationLockTtlMs: Number.isFinite(configuredGenerationLockTtl)
        ? Math.min(30 * 60 * 1000, Math.max(60 * 1000, configuredGenerationLockTtl))
        : 2 * 60 * 1000,
      cacheMaxBytes: 900_000,
      rateLimitWindowMs: numeric(env, 'REPORT_RATE_LIMIT_WINDOW_MS', 60 * 1000),
      rateLimitMax: numeric(env, 'REPORT_RATE_LIMIT_MAX', 12),
      requireTokenForArchive: env.REQUIRE_REPORT_TOKEN_FOR_ARCHIVE !== 'false'
    },
    payment: {
      provider: paymentProvider,
      configured: paymentProvider === 'legacy-portone'
        ? Boolean(trimmed(env, 'PORTONE_API_SECRET') && trimmed(env, 'PORTONE_STORE_ID'))
        : false
    },
    auth: {
      accessTokenTtlMs: numeric(env, 'AUTH_ACCESS_TOKEN_TTL_MS', 30 * 24 * 60 * 60 * 1000),
      adminAccessTokenTtlMs: numeric(env, 'ADMIN_ACCESS_TOKEN_TTL_MS', 12 * 60 * 60 * 1000),
      adminLoginRateLimitWindowMs: Number.isFinite(configuredAdminRateWindow)
        ? Math.min(60 * 60 * 1000, Math.max(60 * 1000, configuredAdminRateWindow))
        : 15 * 60 * 1000,
      adminLoginRateLimitMax: Number.isFinite(configuredAdminRateMax)
        ? Math.min(20, Math.max(3, Math.floor(configuredAdminRateMax)))
        : 5,
      reportAccessSecret: trimmed(env, 'REPORT_ACCESS_SECRET'),
      userAccessSecret: trimmed(env, 'USER_ACCESS_SECRET'),
      adminAccessSecret: trimmed(env, 'ADMIN_ACCESS_SECRET'),
      adminCredentialHash: trimmed(env, 'ADMIN_CREDENTIAL_HASH')
    },
    portOne: {
      apiBaseUrl: (trimmed(env, 'PORTONE_API_BASE_URL') || 'https://api.portone.io').replace(/\/$/, ''),
      apiSecret: trimmed(env, 'PORTONE_API_SECRET'),
      storeId: trimmed(env, 'PORTONE_STORE_ID'),
      ledgerCollection: trimmed(env, 'PORTONE_PAYMENT_LEDGER_COLLECTION') || 'portonePaymentConfirmations'
    },
    kakao: {
      restApiKey: trimmed(env, 'KAKAO_REST_API_KEY'),
      clientSecret: trimmed(env, 'KAKAO_CLIENT_SECRET'),
      tokenEndpoint: 'https://kauth.kakao.com/oauth/token',
      userEndpoint: 'https://kapi.kakao.com/v2/user/me'
    },
    firestore: {
      enabled: env.ENABLE_FIRESTORE_ARCHIVE === 'true',
      projectId:
        trimmed(env, 'FIRESTORE_PROJECT_ID') ||
        trimmed(env, 'GOOGLE_CLOUD_PROJECT') ||
        trimmed(env, 'GCLOUD_PROJECT') ||
        trimmed(env, 'GCP_PROJECT'),
      databaseId: trimmed(env, 'FIRESTORE_DATABASE_ID') || '(default)',
      archiveCollection: trimmed(env, 'FIRESTORE_ARCHIVE_COLLECTION') || 'reportArchives',
      /* 쿠폰 보유·사용 기록. 쿠폰 정의는 코드에 있고 여기에는 이력만 쌓인다. */
      couponCollection: trimmed(env, 'FIRESTORE_COUPON_COLLECTION') || 'couponGrants',
      /* 선물 한 장이 한 번만 쓰이는 것을 이 컬렉션이 기록으로 지킨다. */
      giftCollection: trimmed(env, 'FIRESTORE_GIFT_COLLECTION') || 'giftCodes',
      accessToken: trimmed(env, 'FIRESTORE_ACCESS_TOKEN')
    },
    guiyeondo: {
      enabled: env.ENABLE_FIRESTORE_ARCHIVE === 'true' && env.ENABLE_GUIYEONDO === 'true',
      inviteCollection: trimmed(env, 'GUIYEONDO_INVITE_COLLECTION') || 'guiyeondoInvites',
      responseCollection: trimmed(env, 'GUIYEONDO_RESPONSE_COLLECTION') || 'guiyeondoResponses',
      rateLimitCollection: trimmed(env, 'GUIYEONDO_RATE_LIMIT_COLLECTION') || 'guiyeondoRateLimits',
      inviteTtlMs: Number.isFinite(configuredGuiyeondoTtl)
        ? Math.min(14 * 24 * 60 * 60 * 1000, Math.max(60 * 60 * 1000, configuredGuiyeondoTtl))
        : 14 * 24 * 60 * 60 * 1000,
      rateLimitWindowMs: Number.isFinite(configuredGuiyeondoRateWindow)
        ? Math.min(10 * 60 * 1000, Math.max(10 * 1000, configuredGuiyeondoRateWindow))
        : 60 * 1000,
      createRateLimitMax: boundedGuiyeondoRateMax(env, 'GUIYEONDO_CREATE_RATE_LIMIT_MAX', 10, 1, 30),
      readRateLimitMax: boundedGuiyeondoRateMax(env, 'GUIYEONDO_READ_RATE_LIMIT_MAX', 120, 10, 300),
      responseRateLimitMax: boundedGuiyeondoRateMax(env, 'GUIYEONDO_RESPONSE_RATE_LIMIT_MAX', 10, 1, 30),
      ownerRateLimitMax: boundedGuiyeondoRateMax(env, 'GUIYEONDO_OWNER_RATE_LIMIT_MAX', 60, 5, 120)
    },
    gemini: {
      configured: Boolean(trimmed(env, 'GEMINI_API_KEY')),
      model: trimmed(env, 'GEMINI_MODEL') || 'gemini-2.5-flash'
    },
    kasi: {
      lunarConfigured: Boolean(lunarKasiKey),
      specialDayConfigured: Boolean(specialDayKasiKey)
    }
  };
}
