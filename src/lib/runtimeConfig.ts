export const CLOUD_RUN_API_BASE_URL = 'https://unwoldang-report-api-pt76url4oa-du.a.run.app';

export const DEFAULT_REPORT_ENDPOINT = `${CLOUD_RUN_API_BASE_URL}/api/report`;
export const DEFAULT_KAKAO_TOKEN_EXCHANGE_ENDPOINT = `${CLOUD_RUN_API_BASE_URL}/api/auth/kakao/exchange`;
export const DEFAULT_REPORT_ARCHIVE_ENDPOINT = `${CLOUD_RUN_API_BASE_URL}/api/archive/reports`;
export const DEFAULT_ADMIN_LOGIN_ENDPOINT = `${CLOUD_RUN_API_BASE_URL}/api/admin/login`;
export const DEFAULT_ADMIN_REPORTS_ENDPOINT = `${CLOUD_RUN_API_BASE_URL}/api/admin/reports`;

export function getAiReportEndpoint() {
  return import.meta.env.VITE_REPORT_ENDPOINT?.trim() || import.meta.env.VITE_OPENAI_REPORT_ENDPOINT?.trim() || DEFAULT_REPORT_ENDPOINT;
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

export function getPaymentMode() {
  const mode = import.meta.env.VITE_PAYMENT_MODE;

  if (mode === 'live' || mode === 'test') {
    return mode;
  }

  return 'demo';
}

export function hasPortOneRuntimeConfig() {
  return Boolean(
    import.meta.env.VITE_PORTONE_STORE_ID?.trim() &&
      import.meta.env.VITE_PORTONE_CHANNEL_KEY?.trim() &&
      getPortOneConfirmEndpoint()
  );
}

export function shouldUseDemoPayment() {
  return getPaymentMode() !== 'live' || !hasPortOneRuntimeConfig();
}
