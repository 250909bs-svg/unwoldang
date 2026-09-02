import type { IntakeFormData } from '../api/mockData';
import { buildAnalysisRequestPayload } from './analysisPayload';
import {
  isReleasePreflightResult,
  type ReleasePreflightResult
} from './releasePreflightContract';
import { getReleasePreflightEndpoint } from './runtimeConfig';

const RELEASE_PREFLIGHT_TIMEOUT_MS = 15_000;

async function readErrorMessage(response: Response) {
  const payload = (await response.json().catch(() => null)) as { message?: unknown } | null;
  return typeof payload?.message === 'string' && payload.message.trim()
    ? payload.message
    : '종합사주 자동 발행 가능 여부를 확인하지 못했습니다.';
}

export async function requestGeneralSignatureReleasePreflight(
  formData: Partial<IntakeFormData>,
  options: { fetchImplementation?: typeof fetch; endpoint?: string } = {}
): Promise<ReleasePreflightResult> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), RELEASE_PREFLIGHT_TIMEOUT_MS);

  try {
    const fetchImplementation = options.fetchImplementation || globalThis.fetch;
    const response = await fetchImplementation(
      options.endpoint || getReleasePreflightEndpoint(),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          serviceId: 'general-signature',
          payload: buildAnalysisRequestPayload('general-signature', formData)
        })
      }
    );

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const payload = await response.json();
    if (!isReleasePreflightResult(payload)) {
      throw new Error('종합사주 preflight 응답 형식이 올바르지 않습니다.');
    }

    return payload;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('종합사주 사전 판정 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
