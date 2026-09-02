export const CLOUD_RUN_API_BASE_URL = 'https://unwoldang-report-api-pt76url4oa-du.a.run.app';

export const DEFAULT_REPORT_ENDPOINT = `${CLOUD_RUN_API_BASE_URL}/api/report`;
export const DEFAULT_RELEASE_PREFLIGHT_ENDPOINT = `${CLOUD_RUN_API_BASE_URL}/api/report/preflight`;
export const DEFAULT_KAKAO_TOKEN_EXCHANGE_ENDPOINT = `${CLOUD_RUN_API_BASE_URL}/api/auth/kakao/exchange`;
export const DEFAULT_REPORT_ARCHIVE_ENDPOINT = `${CLOUD_RUN_API_BASE_URL}/api/archive/reports`;
export const DEFAULT_ADMIN_LOGIN_ENDPOINT = `${CLOUD_RUN_API_BASE_URL}/api/admin/login`;
export const DEFAULT_ADMIN_REPORTS_ENDPOINT = `${CLOUD_RUN_API_BASE_URL}/api/admin/reports`;

export function getAiReportEndpoint() {
  return import.meta.env.VITE_REPORT_ENDPOINT?.trim() || import.meta.env.VITE_OPENAI_REPORT_ENDPOINT?.trim() || DEFAULT_REPORT_ENDPOINT;
}

export function deriveReleasePreflightEndpoint(reportEndpoint: string) {
  const trimmed = reportEndpoint.trim().replace(/\/$/, '');

  if (/\/(?:api\/)?report$/.test(trimmed)) {
    return `${trimmed}/preflight`;
  }

  return DEFAULT_RELEASE_PREFLIGHT_ENDPOINT;
}

export function getReleasePreflightEndpoint() {
  return import.meta.env.VITE_RELEASE_PREFLIGHT_ENDPOINT?.trim() ||
    deriveReleasePreflightEndpoint(getAiReportEndpoint());
}

export function getKakaoTokenExchangeEndpoint() {
  return import.meta.env.VITE_KAKAO_TOKEN_EXCHANGE_ENDPOINT?.trim() || DEFAULT_KAKAO_TOKEN_EXCHANGE_ENDPOINT;
}

export function getReportArchiveEndpoint() {
  return import.meta.env.VITE_REPORT_ARCHIVE_ENDPOINT?.trim() || DEFAULT_REPORT_ARCHIVE_ENDPOINT;
}

export function getAdminLoginEndpoint() {
  return import.meta.env.VITE_ADMIN_LOGIN_ENDPOINT?.trim() || DEFAULT_ADMIN_LOGIN_ENDPOINT;
}

export function getAdminReportsEndpoint() {
  return import.meta.env.VITE_ADMIN_REPORTS_ENDPOINT?.trim() || DEFAULT_ADMIN_REPORTS_ENDPOINT;
}

export function getPortOneConfirmEndpoint() {
  return import.meta.env.VITE_PORTONE_CONFIRM_ENDPOINT?.trim() || '';
}

export type PaymentProviderName = 'disabled' | 'hyphen' | 'legacy-portone';

export function resolvePaymentProvider(provider: string | undefined, isProduction: boolean): PaymentProviderName {
  if (provider === 'disabled' || provider === 'hyphen' || provider === 'legacy-portone') {
    return provider;
  }
  return isProduction ? 'disabled' : 'legacy-portone';
}

export function getPaymentProvider() {
  return resolvePaymentProvider(import.meta.env.VITE_PAYMENT_PROVIDER, import.meta.env.PROD);
}

export type PaymentMode = 'live' | 'test' | 'demo' | 'disabled';

export function resolvePaymentMode(mode: string | undefined, isProduction: boolean): PaymentMode {
  if (isProduction) {
    return mode === 'live' ? 'live' : 'disabled';
  }

  if (mode === 'live' || mode === 'test' || mode === 'demo') {
    return mode;
  }

  return 'demo';
}

export function getPaymentMode() {
  return resolvePaymentMode(import.meta.env.VITE_PAYMENT_MODE, import.meta.env.PROD);
}

export function hasPortOneRuntimeConfig() {
  return Boolean(
    import.meta.env.VITE_PORTONE_STORE_ID?.trim() &&
      import.meta.env.VITE_PORTONE_CHANNEL_KEY?.trim() &&
      getPortOneConfirmEndpoint()
  );
}

export function shouldUseDemoPayment() {
  const mode = getPaymentMode();

  return getPaymentProvider() !== 'disabled' && !import.meta.env.PROD && (mode === 'demo' || mode === 'test');
}
