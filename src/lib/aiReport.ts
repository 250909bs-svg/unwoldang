import type { IntakeFormData, ServiceId } from '../api/mockData';
import { buildAnalysisRequestPayload } from './analysisPayload';
import { PREMIUM_SAJU_PROMPT_VERSION, PREMIUM_SAJU_REPORT_MODE } from './saju/premiumReportPrompt';
import type { SajuReportData } from './saju/report';

type AiReportResponse = {
  report?: SajuReportData;
};

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

export async function requestAiReport(
  serviceId: ServiceId,
  formData: Partial<IntakeFormData>
): Promise<SajuReportData | null> {
  const endpoint = getAiReportEndpoint();

  if (!endpoint) {
    return null;
  }

  const payload = buildAnalysisRequestPayload(serviceId, formData);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      serviceId,
      payload,
      reportMode: PREMIUM_SAJU_REPORT_MODE,
      promptVersion: PREMIUM_SAJU_PROMPT_VERSION
    })
  });

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
