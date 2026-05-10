import type { IntakeFormData, ServiceId } from '../api/mockData';
import { buildAnalysisRequestPayload } from './analysisPayload';
import { PREMIUM_SAJU_PROMPT_VERSION, PREMIUM_SAJU_REPORT_MODE } from './saju/premiumReportPrompt';
import type { SajuReportData } from './saju/report';

type AiReportResponse = {
  report?: SajuReportData;
};

const DEFAULT_AI_REPORT_TIMEOUT_MS = 45000;

function isReportShape(value: unknown): value is SajuReportData {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SajuReportData>;
  return Boolean(candidate.title && candidate.summary && Array.isArray(candidate.sections));
}

export function getAiReportEndpoint() {
  return import.meta.env.VITE_REPORT_ENDPOINT?.trim() || import.meta.env.VITE_OPENAI_REPORT_ENDPOINT?.trim() || '';
}

function getAiReportTimeoutMs() {
  const configured = Number(import.meta.env.VITE_REPORT_TIMEOUT_MS);

  if (Number.isFinite(configured) && configured >= 10000) {
    return configured;
  }

  return DEFAULT_AI_REPORT_TIMEOUT_MS;
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

export async function requestAiReport(
  serviceId: ServiceId,
  formData: Partial<IntakeFormData>
): Promise<SajuReportData | null> {
  const endpoint = getAiReportEndpoint();

  if (!endpoint) {
    return null;
  }

  const payload = buildAnalysisRequestPayload(serviceId, formData);
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), getAiReportTimeoutMs());
  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        serviceId,
        payload,
        reportMode: PREMIUM_SAJU_REPORT_MODE,
        promptVersion: PREMIUM_SAJU_PROMPT_VERSION
      })
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error('AI 분석 응답이 지연되어 내부 리포트로 먼저 전환합니다.');
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error('AI 사주 리포트 생성 요청이 실패했습니다.');
  }

  const parsed = (await response.json()) as AiReportResponse | SajuReportData;
  const report = 'report' in parsed ? parsed.report : parsed;

  if (!isReportShape(report)) {
    throw new Error('AI 리포트 응답 형식이 올바르지 않습니다.');
  }

  return report;
}
