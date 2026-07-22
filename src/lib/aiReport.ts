import type { IntakeFormData, ServiceId } from '../api/mockData';
import { fetchCloudRunApi } from '../shared/api/cloudRunFetch';
import { adaptApiError, readApiErrorResponse } from '../shared/api/errorAdapter';
import { buildAnalysisRequestPayload } from './analysisPayload';
import { getAiReportEndpoint } from './runtimeConfig';
import { PREMIUM_SAJU_PROMPT_VERSION, PREMIUM_SAJU_REPORT_MODE } from './saju/premiumReportPrompt';
import type { SajuReportData } from './saju/report';

export { getAiReportEndpoint } from './runtimeConfig';

export type AiReportProvider = 'gemini' | 'deterministic-fallback';

type AiReportResponse = {
  report?: SajuReportData;
  provider?: AiReportProvider;
};

export type AiReportResult = {
  report: SajuReportData;
  provider: AiReportProvider | null;
  degraded: boolean;
};

const DEFAULT_AI_REPORT_TIMEOUT_MS = 30000;
const DEFAULT_AI_REPORT_TOTAL_DEADLINE_MS = 90000;
const TRANSIENT_REPORT_STATUSES = new Set([425, 429, 502, 503, 504]);
const MAX_TRANSIENT_RETRIES = 2;

function isReportShape(value: unknown): value is SajuReportData {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SajuReportData>;
  return Boolean(candidate.title && candidate.summary && Array.isArray(candidate.sections));
}

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

function classifyReportResponse(response: Response, errorCode: string) {
  if (
    (response.status === 409 || response.status === 202) &&
    errorCode === 'REPORT_GENERATION_IN_PROGRESS'
  ) {
    return 'in-progress' as const;
  }

  if (TRANSIENT_REPORT_STATUSES.has(response.status)) {
    return 'transient' as const;
  }

  return 'fatal' as const;
}

function parseAiReportResult(parsed: AiReportResponse | SajuReportData): AiReportResult {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('AI 리포트 응답 형식이 올바르지 않습니다.');
  }

  const isEnvelope = 'report' in parsed;
  const report = isEnvelope ? parsed.report : parsed;
  const rawProvider = isEnvelope ? parsed.provider : null;
  const provider = rawProvider === 'gemini' || rawProvider === 'deterministic-fallback' ? rawProvider : null;

  if (!isReportShape(report)) {
    throw new Error('AI 리포트 응답 형식이 올바르지 않습니다.');
  }

  return {
    report,
    provider,
    degraded: provider !== 'gemini'
  };
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

  const payload = buildAnalysisRequestPayload(serviceId, formData);
  const requestBody = JSON.stringify({
    serviceId,
    orderId: options.orderId,
    payload,
    reportMode: PREMIUM_SAJU_REPORT_MODE,
    promptVersion: PREMIUM_SAJU_PROMPT_VERSION
  });
  const deadline = Date.now() + DEFAULT_AI_REPORT_TOTAL_DEADLINE_MS;
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
      const response = await fetchCloudRunApi(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(options.reportAccessToken ? { Authorization: `Bearer ${options.reportAccessToken}` } : {})
        },
        signal: controller.signal,
        body: requestBody
      });

      if (response.ok && response.status !== 202) {
        const parsed = (await response.json()) as AiReportResponse | SajuReportData;
        return parseAiReportResult(parsed);
      }

      const responseError = await readApiErrorResponse(response, {
        fallbackCode: 'REPORT_GENERATION_FAILED'
      });
      const responseKind = classifyReportResponse(response, responseError.code);

      if (responseKind === 'fatal') {
        throw responseError;
      }

      if (responseKind === 'transient') {
        if (transientRetries >= MAX_TRANSIENT_RETRIES) {
          throw responseError;
        }
        transientRetries += 1;
      }

      lastError = responseError;
      const delayMs = Math.min(getRetryDelayMs(response, attempt), Math.max(0, deadline - Date.now()));

      if (delayMs > 0) {
        await waitForRetry(delayMs);
      }
    } catch (error) {
      lastError = error;

      if (!isAbortError(error) && !(error instanceof TypeError)) {
        throw error;
      }

      if (transientRetries >= MAX_TRANSIENT_RETRIES) {
        throw adaptApiError(error, { fallbackCode: 'REPORT_GENERATION_FAILED' });
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

  throw adaptApiError(lastError, {
    fallbackCode: isAbortError(lastError)
      ? 'REPORT_GENERATION_IN_PROGRESS'
      : 'REPORT_GENERATION_FAILED'
  });
}
