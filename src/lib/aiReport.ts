import type { IntakeFormData, ServiceId } from '../api/mockData';
import { getReportProductAdapter } from '../features/reports/adapters';
import {
  REPORT_REQUEST_SCHEMA_VERSION,
  ReportGenerationError,
  parseReportRequestV1,
  type ReportRequestV1
} from '../features/reports/contracts';
import {
  createReportHttpError,
  normalizeReportClientError,
  parseReportClientResult,
  type ReportClientProvider,
  type ReportClientResult
} from '../features/reports/clientBoundary';
import { buildAnalysisRequestPayload } from './analysisPayload';
import { getAiReportEndpoint } from './runtimeConfig';
import { PREMIUM_SAJU_PROMPT_VERSION, PREMIUM_SAJU_REPORT_MODE } from './saju/premiumReportPrompt';

export { getAiReportEndpoint } from './runtimeConfig';
export { ReportGenerationError };
export type { ReportErrorCode, ReportGenerationMetaV1 } from '../features/reports/contracts';

export type AiReportProvider = ReportClientProvider;
export type AiReportResult = ReportClientResult;

const DEFAULT_AI_REPORT_TIMEOUT_MS = 30000;
const DEFAULT_AI_REPORT_TOTAL_DEADLINE_MS = 90000;
const TRANSIENT_REPORT_STATUSES = new Set([425, 429, 502, 503, 504]);
const MAX_TRANSIENT_RETRIES = 2;

type ReportErrorPayload = {
  code: string;
  message: string;
  retryable?: boolean;
};

function getAiReportTimeoutMs() {
  const configured = Number(import.meta.env.VITE_REPORT_TIMEOUT_MS);

  if (Number.isFinite(configured) && configured >= 10000) {
    return Math.max(configured, DEFAULT_AI_REPORT_TIMEOUT_MS);
  }

  return DEFAULT_AI_REPORT_TIMEOUT_MS;
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

function waitForRetry(delayMs: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, delayMs));
}

function getRetryDelayMs(response: Response, attempt: number) {
  const retryAfter = Number(response.headers.get('Retry-After'));

  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, 5000);
  }

  return Math.min(1000 * 2 ** attempt, 4000);
}

async function readReportError(response: Response) {
  const decoded: unknown = await response.json().catch(() => null);
  const payload = decoded !== null && typeof decoded === 'object' && !Array.isArray(decoded)
    ? decoded as Record<string, unknown>
    : null;

  return {
    code: typeof payload?.code === 'string' ? payload.code : '',
    message: typeof payload?.message === 'string' ? payload.message : '',
    ...(typeof payload?.retryable === 'boolean'
      ? { retryable: payload.retryable }
      : {})
  };
}

function classifyReportResponse(response: Response, errorPayload: ReportErrorPayload) {
  if (
    (response.status === 409 || response.status === 202) &&
    (errorPayload.code === 'REPORT_GENERATION_IN_PROGRESS' || errorPayload.code === 'REPORT_LEASE_LOST')
  ) {
    return 'in-progress' as const;
  }

  if (errorPayload.retryable !== undefined) {
    return errorPayload.retryable ? 'transient' as const : 'fatal' as const;
  }

  if (TRANSIENT_REPORT_STATUSES.has(response.status)) {
    return 'transient' as const;
  }

  return 'fatal' as const;
}

export async function requestAiReport(
  serviceId: ServiceId,
  formData: Partial<IntakeFormData>,
  options: { orderId?: string; reportAccessToken?: string } = {}
): Promise<AiReportResult | null> {
  const endpoint = getAiReportEndpoint();

  if (!endpoint) {
    return null;
  }

  let request: ReportRequestV1;
  try {
    request = parseReportRequestV1({
      schemaVersion: REPORT_REQUEST_SCHEMA_VERSION,
      serviceId,
      orderId: options.orderId,
      payload: buildAnalysisRequestPayload(serviceId, formData),
      reportMode: PREMIUM_SAJU_REPORT_MODE,
      promptVersion: PREMIUM_SAJU_PROMPT_VERSION
    });
    getReportProductAdapter(serviceId).prompt.describe(request);
  } catch (error) {
    throw normalizeReportClientError(error);
  }

  const requestBody = JSON.stringify(request);
  const startedAt = Date.now();
  const deadline = startedAt + DEFAULT_AI_REPORT_TOTAL_DEADLINE_MS;
  let attempt = 0;
  let transientRetries = 0;
  let lastError: unknown;

  while (Date.now() < deadline) {
    const controller = new AbortController();
    const remainingMs = deadline - Date.now();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      Math.max(1, Math.min(getAiReportTimeoutMs(), remainingMs))
    );

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(options.reportAccessToken ? { Authorization: `Bearer ${options.reportAccessToken}` } : {})
        },
        signal: controller.signal,
        body: requestBody
      });

      if (response.ok && response.status !== 202) {
        const parsed = await response.json();
        return parseReportClientResult(parsed, {
          latencyMs: Math.max(0, Date.now() - startedAt),
          attemptCount: attempt + 1
        });
      }

      const errorPayload = await readReportError(response);
      const responseKind = classifyReportResponse(response, errorPayload);

      if (responseKind === 'fatal') {
        throw createReportHttpError({
          status: response.status,
          serverCode: errorPayload.code,
          serverRetryable: errorPayload.retryable,
          message: errorPayload.message || 'AI 사주 리포트 생성 요청에 실패했습니다.'
        });
      }

      if (responseKind === 'transient') {
        if (transientRetries >= MAX_TRANSIENT_RETRIES) {
          throw createReportHttpError({
            status: response.status,
            serverCode: errorPayload.code,
            serverRetryable: errorPayload.retryable,
            message: errorPayload.message || '리포트 서버가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해 주세요.'
          });
        }
        transientRetries += 1;
      }

      const delayMs = Math.min(getRetryDelayMs(response, attempt), Math.max(0, deadline - Date.now()));
      lastError = createReportHttpError({
        status: response.status,
        serverCode: errorPayload.code,
        serverRetryable: errorPayload.retryable,
        message: errorPayload.message || `AI report is not ready yet (${response.status}).`,
        retryAfterMs: delayMs
      });

      if (delayMs > 0) {
        await waitForRetry(delayMs);
      }
    } catch (error) {
      lastError = error;

      if (!isAbortError(error) && !(error instanceof TypeError)) {
        throw normalizeReportClientError(error);
      }

      if (transientRetries >= MAX_TRANSIENT_RETRIES) {
        throw new ReportGenerationError({
          code: isAbortError(error) ? 'REPORT_TIMEOUT' : 'REPORT_NETWORK_ERROR',
          message: '네트워크 연결이 불안정합니다. 결제 내역은 보존되므로 잠시 후 다시 시도해 주세요.',
          retryable: true
        });
      }
      transientRetries += 1;

      const delayMs = Math.min(1000, Math.max(0, deadline - Date.now()));

      if (delayMs > 0) {
        await waitForRetry(delayMs);
      }
    } finally {
      window.clearTimeout(timeoutId);
    }

    attempt += 1;
  }

  throw new ReportGenerationError({
    code: 'REPORT_TIMEOUT',
    message: isAbortError(lastError)
      ? 'AI 분석 응답이 지연되고 있습니다. 결제 내역은 보존되며 다시 시도하면 완료된 리포트를 이어받습니다.'
      : '리포트 생성이 아직 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.',
    retryable: true
  });
}
