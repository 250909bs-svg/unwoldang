import type { SajuReportData } from '../../lib/saju/report';
import {
  REPORT_RESPONSE_SCHEMA_VERSION,
  ReportContractError,
  ReportGenerationError,
  isReportErrorCode,
  parseReportResponseV1,
  type ReportErrorCode,
  type ReportGenerationMetaV1
} from './contracts';

export type ReportClientProvider = 'gemini' | 'deterministic-fallback';

export type ReportClientResult = {
  report: SajuReportData;
  provider: ReportClientProvider | null;
  degraded: boolean;
  schemaVersion: typeof REPORT_RESPONSE_SCHEMA_VERSION;
  generationMeta: ReportGenerationMetaV1;
  reportMode?: string;
  promptVersion?: string;
};

const RETRYABLE_CODES = new Set<ReportErrorCode>([
  'REPORT_GENERATION_IN_PROGRESS',
  'REPORT_LEASE_LOST',
  'REPORT_RATE_LIMITED',
  'REPORT_PROVIDER_UNAVAILABLE',
  'REPORT_STORAGE_UNAVAILABLE',
  'REPORT_TIMEOUT',
  'REPORT_NETWORK_ERROR'
]);

function isVersionedResponse(value: unknown) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).schemaVersion === REPORT_RESPONSE_SCHEMA_VERSION
  );
}

export function parseReportClientResult(
  value: unknown,
  clientMetrics: { latencyMs: number; attemptCount: number }
): ReportClientResult {
  try {
    const normalized = parseReportResponseV1(value);
    const generationMeta = isVersionedResponse(value)
      ? normalized.generationMeta
      : {
          ...normalized.generationMeta,
          latencyMs: clientMetrics.latencyMs,
          attemptCount: clientMetrics.attemptCount
        };
    const provider = normalized.provider === 'gemini' || normalized.provider === 'deterministic-fallback'
      ? normalized.provider
      : null;

    return {
      report: normalized.report,
      provider,
      degraded: generationMeta.fallback || provider !== 'gemini',
      schemaVersion: REPORT_RESPONSE_SCHEMA_VERSION,
      generationMeta,
      reportMode: normalized.reportMode,
      promptVersion: normalized.promptVersion
    };
  } catch (error) {
    if (error instanceof ReportContractError) {
      throw new ReportGenerationError({
        code: 'REPORT_RESPONSE_INVALID',
        message: error.message,
        retryable: false
      });
    }
    throw error;
  }
}

export function resolveReportHttpErrorCode(status: number, serverCode?: unknown): ReportErrorCode {
  if (isReportErrorCode(serverCode)) return serverCode;
  if (status === 401) return 'REPORT_AUTH_REQUIRED';
  if (status === 403) return 'REPORT_ENTITLEMENT_INVALID';
  if (status === 409) return 'REPORT_INPUT_CONFLICT';
  if (status === 425 || status === 429) return 'REPORT_RATE_LIMITED';
  if (status === 400 || status === 422) return 'REPORT_REQUEST_INVALID';
  if (status === 502 || status === 503 || status === 504) return 'REPORT_PROVIDER_UNAVAILABLE';
  return 'REPORT_UNKNOWN_ERROR';
}

export function createReportHttpError(input: {
  status: number;
  serverCode?: unknown;
  serverRetryable?: boolean;
  message: string;
  retryAfterMs?: number;
}) {
  const code = resolveReportHttpErrorCode(input.status, input.serverCode);
  return new ReportGenerationError({
    code,
    message: input.message,
    retryable: input.serverRetryable ?? RETRYABLE_CODES.has(code),
    status: input.status,
    retryAfterMs: input.retryAfterMs
  });
}

export function normalizeReportClientError(error: unknown): ReportGenerationError {
  if (error instanceof ReportGenerationError) return error;
  if (error instanceof ReportContractError) {
    return new ReportGenerationError({
      code: error.code,
      message: error.message,
      retryable: false
    });
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return new ReportGenerationError({
      code: 'REPORT_TIMEOUT',
      message: error.message,
      retryable: true
    });
  }
  if (error instanceof TypeError) {
    return new ReportGenerationError({
      code: 'REPORT_NETWORK_ERROR',
      message: error.message,
      retryable: true
    });
  }
  return new ReportGenerationError({
    code: 'REPORT_UNKNOWN_ERROR',
    message: error instanceof Error ? error.message : 'Unknown report generation error.',
    retryable: false
  });
}
