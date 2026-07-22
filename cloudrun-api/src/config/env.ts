export type RuntimeEnv = Record<string, string | undefined>;

export type RateLimitPolicy = Readonly<{
  windowMs: number;
  max: number;
}>;

export type RateLimitPolicies = Readonly<{
  auth: RateLimitPolicy;
  payment: RateLimitPolicy;
  report: RateLimitPolicy;
  admin: RateLimitPolicy;
}>;

export type AppConfig = ReturnType<typeof loadConfig>;

export const DEFAULT_RATE_LIMITS = Object.freeze({
  auth: Object.freeze({ windowMs: 60_000, max: 20 }),
  payment: Object.freeze({ windowMs: 60_000, max: 30 }),
  report: Object.freeze({ windowMs: 60_000, max: 12 }),
  admin: Object.freeze({ windowMs: 60_000, max: 5 })
}) satisfies RateLimitPolicies;

const POSITIVE_INTEGER_ENV_NAMES = Object.freeze([
  'PORT',
  'REPORT_ACCESS_TOKEN_TTL_MS',
  'PAYMENT_ORDER_CLAIM_TTL_MS',
  'REPORT_GENERATION_LOCK_TTL_MS',
  'AUTH_ACCESS_TOKEN_TTL_MS',
  'ADMIN_ACCESS_TOKEN_TTL_MS',
  'AUTH_RATE_LIMIT_WINDOW_MS',
  'AUTH_RATE_LIMIT_MAX',
  'PAYMENT_RATE_LIMIT_WINDOW_MS',
  'PAYMENT_RATE_LIMIT_MAX',
  'REPORT_RATE_LIMIT_WINDOW_MS',
  'REPORT_RATE_LIMIT_MAX',
  'ADMIN_RATE_LIMIT_WINDOW_MS',
  'ADMIN_RATE_LIMIT_MAX'
] as const);
const MIN_SIGNING_SECRET_LENGTH = 32;
const KNOWN_SIGNING_SECRET_PLACEHOLDERS = new Set([
  'replace_with_a_long_random_secret_value',
  'replace_with_a_different_long_random_secret_value',
  'replace_with_a_third_long_random_secret_value',
  'changeme',
  'change-me',
  'change_me'
]);
const SIGNING_SECRET_PLACEHOLDER_PREFIX =
  /^(?:replace[_-]?with|your|example|fixture|change[_-]?me)(?:[_-]|$)/i;
const PRODUCTION_CONFIGURATION_PLACEHOLDER_PREFIX =
  /^(?:your|store[_-]?your|fixture|example)(?:[_-]|$)/i;

function trimmed(env: RuntimeEnv, name: string) {
  return env[name]?.trim() || '';
}

function numeric(env: RuntimeEnv, name: string, fallback: number) {
  return Number(env[name] || fallback);
}

function rateLimitPolicy(
  env: RuntimeEnv,
  scope: 'AUTH' | 'PAYMENT' | 'REPORT' | 'ADMIN',
  fallback: RateLimitPolicy
): RateLimitPolicy {
  return {
    windowMs: numeric(env, `${scope}_RATE_LIMIT_WINDOW_MS`, fallback.windowMs),
    max: numeric(env, `${scope}_RATE_LIMIT_MAX`, fallback.max)
  };
}

export function loadConfig(env: RuntimeEnv = process.env) {
  const production = env.NODE_ENV === 'production' || Boolean(trimmed(env, 'K_SERVICE'));
  const configuredOrderClaimTtl = numeric(
    env,
    'PAYMENT_ORDER_CLAIM_TTL_MS',
    2 * 60 * 60 * 1000
  );
  const configuredGenerationLockTtl = numeric(
    env,
    'REPORT_GENERATION_LOCK_TTL_MS',
    2 * 60 * 1000
  );
  const rateLimits: RateLimitPolicies = {
    auth: rateLimitPolicy(env, 'AUTH', DEFAULT_RATE_LIMITS.auth),
    payment: rateLimitPolicy(env, 'PAYMENT', DEFAULT_RATE_LIMITS.payment),
    report: rateLimitPolicy(env, 'REPORT', DEFAULT_RATE_LIMITS.report),
    admin: rateLimitPolicy(env, 'ADMIN', DEFAULT_RATE_LIMITS.admin)
  };

  return {
    port: numeric(env, 'PORT', 8080),
    production,
    allowedOrigins: trimmed(env, 'ALLOWED_ORIGINS')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    rateLimits,
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
      rateLimitWindowMs: rateLimits.report.windowMs,
      rateLimitMax: rateLimits.report.max,
      requireTokenForArchive: env.REQUIRE_REPORT_TOKEN_FOR_ARCHIVE !== 'false'
    },
    auth: {
      accessTokenTtlMs: numeric(env, 'AUTH_ACCESS_TOKEN_TTL_MS', 30 * 24 * 60 * 60 * 1000),
      adminAccessTokenTtlMs: numeric(env, 'ADMIN_ACCESS_TOKEN_TTL_MS', 12 * 60 * 60 * 1000),
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
      accessToken: trimmed(env, 'FIRESTORE_ACCESS_TOKEN')
    },
    gemini: {
      configured: Boolean(trimmed(env, 'GEMINI_API_KEY')),
      model: trimmed(env, 'GEMINI_MODEL') || 'gemini-2.5-flash'
    }
  };
}

export class ConfigValidationError extends Error {
  readonly code = 'INVALID_CONFIGURATION';
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid server configuration: ${issues.join(' ')}`);
    this.name = 'ConfigValidationError';
    this.issues = [...issues];
  }
}

function validatePositiveInteger(
  issues: string[],
  name: string,
  value: number,
  maximum = Number.MAX_SAFE_INTEGER
) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    issues.push(`${name} must be a positive integer${
      maximum === Number.MAX_SAFE_INTEGER ? '' : ` no greater than ${maximum}`
    }.`);
  }
}

function validateRawNumericEnvironment(issues: string[], env: RuntimeEnv) {
  for (const name of POSITIVE_INTEGER_ENV_NAMES) {
    const rawValue = trimmed(env, name);

    if (!rawValue) {
      continue;
    }

    const maximum = name === 'PORT' ? 65_535 : Number.MAX_SAFE_INTEGER;
    validatePositiveInteger(issues, name, Number(rawValue), maximum);
  }
}

function requireProductionValue(issues: string[], name: string, configured: boolean) {
  if (!configured) {
    issues.push(`${name} is required in production.`);
  }
}

function isKnownSigningSecretPlaceholder(secret: string) {
  const normalized = secret.toLowerCase();
  return (
    KNOWN_SIGNING_SECRET_PLACEHOLDERS.has(normalized) ||
    SIGNING_SECRET_PLACEHOLDER_PREFIX.test(normalized)
  );
}

function validateProductionSigningSecrets(issues: string[], config: AppConfig) {
  const signingSecrets = [
    ['REPORT_ACCESS_SECRET', config.auth.reportAccessSecret],
    ['USER_ACCESS_SECRET', config.auth.userAccessSecret],
    ['ADMIN_ACCESS_SECRET', config.auth.adminAccessSecret]
  ] as const;

  for (const [name, secret] of signingSecrets) {
    if (
      secret &&
      (Array.from(secret).length < MIN_SIGNING_SECRET_LENGTH ||
        isKnownSigningSecretPlaceholder(secret))
    ) {
      issues.push(
        `${name} must contain at least 32 characters and cannot use a known placeholder.`
      );
    }
  }

  const configuredSecrets = signingSecrets
    .map(([, secret]) => secret)
    .filter(Boolean);

  if (
    configuredSecrets.length === signingSecrets.length &&
    new Set(configuredSecrets).size !== signingSecrets.length
  ) {
    issues.push(
      'REPORT_ACCESS_SECRET, USER_ACCESS_SECRET, and ADMIN_ACCESS_SECRET must be distinct.'
    );
  }

  if (
    config.auth.adminCredentialHash &&
    !/^[a-f0-9]{64}$/.test(config.auth.adminCredentialHash)
  ) {
    issues.push(
      'ADMIN_CREDENTIAL_HASH must be a lowercase 64-character hexadecimal SHA-256 digest.'
    );
  }
}

function isLocalProductionHostname(hostname: string) {
  const normalized = hostname
    .replace(/^\[|\]$/g, '')
    .toLowerCase();

  return (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized === '::1' ||
    normalized === '0:0:0:0:0:0:0:1' ||
    /^127(?:\.\d{1,3}){3}$/.test(normalized)
  );
}

function isExactProductionOrigin(origin: string) {
  if (!origin || origin === 'null' || origin.includes('*')) {
    return false;
  }

  try {
    const parsed = new URL(origin);

    return (
      parsed.protocol === 'https:' &&
      parsed.origin === origin &&
      !parsed.username &&
      !parsed.password &&
      parsed.pathname === '/' &&
      !parsed.search &&
      !parsed.hash &&
      !isLocalProductionHostname(parsed.hostname)
    );
  } catch {
    return false;
  }
}

function validateProductionOrigins(issues: string[], origins: readonly string[]) {
  if (origins.some((origin) => !isExactProductionOrigin(origin))) {
    issues.push(
      'ALLOWED_ORIGINS contains an invalid production origin.'
    );
  }
}

function validateProductionProviderConfiguration(issues: string[], config: AppConfig) {
  const requiredConfiguration = [
    ['KAKAO_REST_API_KEY', config.kakao.restApiKey],
    ['PORTONE_API_SECRET', config.portOne.apiSecret],
    ['PORTONE_STORE_ID', config.portOne.storeId],
    ['FIRESTORE_PROJECT_ID', config.firestore.projectId]
  ] as const;

  for (const [name, value] of requiredConfiguration) {
    if (value && PRODUCTION_CONFIGURATION_PLACEHOLDER_PREFIX.test(value.trim())) {
      issues.push(`${name} cannot use a known placeholder in production.`);
    }
  }
}

function validateProductionOptionalEnvironmentPlaceholders(
  issues: string[],
  env: RuntimeEnv
) {
  const optionalEnvironmentNames = [
    'GEMINI_API_KEY',
    'KASI_SERVICE_KEY',
    'DATA_GO_KR_SERVICE_KEY',
    'PUBLIC_DATA_SERVICE_KEY',
    'KAKAO_CLIENT_SECRET'
  ] as const;

  for (const name of optionalEnvironmentNames) {
    const value = trimmed(env, name);
    if (value && PRODUCTION_CONFIGURATION_PLACEHOLDER_PREFIX.test(value)) {
      issues.push(`${name} cannot use a known placeholder in production.`);
    }
  }
}

export function validateConfig(config: AppConfig, env?: RuntimeEnv): AppConfig {
  const issues: string[] = [];

  validatePositiveInteger(issues, 'PORT', config.port, 65_535);
  validatePositiveInteger(issues, 'REPORT_ACCESS_TOKEN_TTL_MS', config.report.accessTokenTtlMs);
  validatePositiveInteger(issues, 'PAYMENT_ORDER_CLAIM_TTL_MS', config.report.orderClaimTtlMs);
  validatePositiveInteger(issues, 'REPORT_GENERATION_LOCK_TTL_MS', config.report.generationLockTtlMs);
  validatePositiveInteger(issues, 'AUTH_ACCESS_TOKEN_TTL_MS', config.auth.accessTokenTtlMs);
  validatePositiveInteger(issues, 'ADMIN_ACCESS_TOKEN_TTL_MS', config.auth.adminAccessTokenTtlMs);

  for (const [scope, policy] of Object.entries(config.rateLimits)) {
    const prefix = scope.toUpperCase();
    validatePositiveInteger(issues, `${prefix}_RATE_LIMIT_WINDOW_MS`, policy.windowMs);
    validatePositiveInteger(issues, `${prefix}_RATE_LIMIT_MAX`, policy.max);
  }

  if (env) {
    validateRawNumericEnvironment(issues, env);
  }

  if (config.production) {
    requireProductionValue(issues, 'ALLOWED_ORIGINS', config.allowedOrigins.length > 0);
    requireProductionValue(issues, 'REPORT_ACCESS_SECRET', Boolean(config.auth.reportAccessSecret));
    requireProductionValue(issues, 'USER_ACCESS_SECRET', Boolean(config.auth.userAccessSecret));
    requireProductionValue(issues, 'ADMIN_ACCESS_SECRET', Boolean(config.auth.adminAccessSecret));
    requireProductionValue(issues, 'ADMIN_CREDENTIAL_HASH', Boolean(config.auth.adminCredentialHash));
    requireProductionValue(issues, 'KAKAO_REST_API_KEY', Boolean(config.kakao.restApiKey));
    requireProductionValue(issues, 'PORTONE_API_SECRET', Boolean(config.portOne.apiSecret));
    requireProductionValue(issues, 'PORTONE_STORE_ID', Boolean(config.portOne.storeId));
    requireProductionValue(issues, 'ENABLE_FIRESTORE_ARCHIVE=true', config.firestore.enabled);
    requireProductionValue(
      issues,
      'FIRESTORE_PROJECT_ID or a Google Cloud project environment variable',
      Boolean(config.firestore.projectId)
    );
    validateProductionOrigins(issues, config.allowedOrigins);
    validateProductionSigningSecrets(issues, config);
    validateProductionProviderConfiguration(issues, config);
    if (env) {
      validateProductionOptionalEnvironmentPlaceholders(issues, env);
    }

    if (!config.report.requireTokenForArchive) {
      issues.push('REQUIRE_REPORT_TOKEN_FOR_ARCHIVE=false is forbidden in production.');
    }

    if (config.firestore.accessToken) {
      issues.push('FIRESTORE_ACCESS_TOKEN is forbidden in production; use the Cloud Run service account.');
    }

    if (env?.ALLOW_UNVERIFIED_REPORTS === 'true') {
      issues.push('ALLOW_UNVERIFIED_REPORTS=true is forbidden in production.');
    }

    try {
      const portOneUrl = new URL(config.portOne.apiBaseUrl);

      if (portOneUrl.protocol !== 'https:') {
        issues.push('PORTONE_API_BASE_URL must use HTTPS in production.');
      }
    } catch {
      issues.push('PORTONE_API_BASE_URL must be a valid HTTPS URL in production.');
    }
  }

  if (issues.length > 0) {
    throw new ConfigValidationError(issues);
  }

  return config;
}

export function loadValidatedConfig(env: RuntimeEnv = process.env): AppConfig {
  return validateConfig(loadConfig(env), env);
}
