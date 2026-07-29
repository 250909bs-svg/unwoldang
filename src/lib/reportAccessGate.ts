import type { ServiceId } from '../api/mockData';

export type ReportAccessMode = 'local-preview' | 'new-generation' | 'archive-replay' | 'locked';

export type ReportAccessGateInput = {
  hostname: string;
  isDevelopment: boolean;
  expectedServiceId: ServiceId;
  orderId?: string;
  reportAccessToken?: string;
  reportData?: unknown;
};

export type ReportAccessGateResult = {
  mode: ReportAccessMode;
  canRender: boolean;
  canArchive: boolean;
  usesPreviewData: boolean;
  reason?: 'missing-order' | 'invalid-report-data' | 'report-service-mismatch';
};

const PAYMENT_ORDER_ID_PATTERN = /^UW-[A-Za-z0-9._-]{12,116}$/;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export const isLoopbackHostname = (hostname: string) => {
  const normalized = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
};

export const isLocalReportPreviewAllowed = (hostname: string, isDevelopment: boolean) =>
  isDevelopment && isLoopbackHostname(hostname);

export const isValidPaymentOrderId = (orderId: unknown): orderId is string =>
  typeof orderId === 'string' && PAYMENT_ORDER_ID_PATTERN.test(orderId.trim());

function inspectReportData(reportData: unknown, expectedServiceId: ServiceId) {
  if (!reportData || typeof reportData !== 'object' || Array.isArray(reportData)) {
    return { valid: false, serviceMatches: false };
  }

  const candidate = reportData as Record<string, unknown>;
  const structurallyValid =
    isNonEmptyString(candidate.serviceId) &&
    isNonEmptyString(candidate.serialNumber) &&
    isNonEmptyString(candidate.title) &&
    isNonEmptyString(candidate.customerName) &&
    isNonEmptyString(candidate.createdAt) &&
    Array.isArray(candidate.sections) &&
    Array.isArray(candidate.keyTakeaways) &&
    Array.isArray(candidate.yearLuck) &&
    Array.isArray(candidate.monthLuck) &&
    Boolean(candidate.pillars && typeof candidate.pillars === 'object' && !Array.isArray(candidate.pillars));

  return {
    valid: structurallyValid,
    serviceMatches: candidate.serviceId === expectedServiceId
  };
}

/**
 * Client-side defense in depth only. Payment/report authorization must still be
 * validated by the server that issues the report and accepts archive writes.
 */
export function evaluateReportAccess(input: ReportAccessGateInput): ReportAccessGateResult {
  const localPreviewAllowed = isLocalReportPreviewAllowed(input.hostname, input.isDevelopment);
  const reportInspection = inspectReportData(input.reportData, input.expectedServiceId);
  const hasOrderId = isValidPaymentOrderId(input.orderId);

  if (hasOrderId && reportInspection.valid && reportInspection.serviceMatches) {
    return {
      mode: isNonEmptyString(input.reportAccessToken) ? 'new-generation' : 'archive-replay',
      canRender: true,
      canArchive: true,
      usesPreviewData: false
    };
  }

  if (localPreviewAllowed) {
    return {
      mode: 'local-preview',
      canRender: true,
      canArchive: false,
      usesPreviewData: true
    };
  }

  const reason = !hasOrderId
    ? 'missing-order'
    : reportInspection.valid && !reportInspection.serviceMatches
      ? 'report-service-mismatch'
      : 'invalid-report-data';

  return {
    mode: 'locked',
    canRender: false,
    canArchive: false,
    usesPreviewData: false,
    reason
  };
}
