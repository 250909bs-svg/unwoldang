import type { IntakeFormData, ServiceId } from '../api/mockData';
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

async function readReportError(response: Response) {
  const payload = (await response.json().catch(() => null)) as { code?: string; message?: string } | null;

  return {
    code: typeof payload?.code === 'string' ? payload.code : '',
    message: typeof payload?.message === 'string' ? payload.message : ''
  };
}

function classifyReportResponse(response: Response, errorPayload: { code: string; message: string }) {
  if (
    (response.status === 409 || response.status === 202) &&
    errorPayload.code === 'REPORT_GENERATION_IN_PROGRESS'
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
        const parsed = (await response.json()) as AiReportResponse | SajuReportData;
        return parseAiReportResult(parsed);
      }

      const errorPayload = await readReportError(response);
      const responseKind = classifyReportResponse(response, errorPayload);

      if (responseKind === 'fatal') {
        throw new Error(errorPayload.message || 'AI 사주 리포트 생성 요청에 실패했습니다.');
      }

      if (responseKind === 'transient') {
        if (transientRetries >= MAX_TRANSIENT_RETRIES) {
          throw new Error(errorPayload.message || '리포트 서버가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해 주세요.');
        }
        transientRetries += 1;
      }

      lastError = new Error(errorPayload.message || `AI report is not ready yet (${response.status}).`);
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
        throw new Error('네트워크 연결이 불안정합니다. 결제 내역은 보존되므로 잠시 후 다시 시도해 주세요.');
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

  throw new Error(
    isAbortError(lastError)
      ? 'AI 분석 응답이 지연되고 있습니다. 결제 내역은 보존되며 다시 시도하면 완료된 리포트를 이어받습니다.'
      : '리포트 생성이 아직 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.'
  );
}
