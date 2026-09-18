/**
 * 배포 지문 — 어느 상품이 어느 산문 모드와 온도로 도는가.
 *
 * ## 왜 별도 파일인가
 *
 * `cloudrun-api` 의 `/health` 가 이 값을 노출해야 한다. 배포 후 로그를 보는 절차의
 * 첫 단계는 "새 코드가 실제로 떠 있는가" 인데 그것을 요청 없이 확인할 지점이 없었고,
 * 롤백(ADR §6-1/§6-2)을 실행했을 때 그것이 배포됐는지 확인할 방법도 없었다.
 *
 * 그런데 `geminiProseGuard` 를 `/health` 가 import 하면 `reportBuilder`(3,300줄)와
 * 그 아래 명리 엔진 전체가 헬스 엔드포인트에 딸려 온다. 판정 규칙은 한 줄짜리
 * 상수 테이블이므로 **무의존 모듈로 뽑는다.** `geminiProseGuard.proseGuardModeFor` 와
 * `geminiReportService` 의 온도 상수가 이 파일을 참조하므로 두 값이 갈라질 수 없다.
 */

export const PREMIUM_SAJU_REPORT_MODE = 'premium_saju_comprehensive_v4' as const;
export const PREMIUM_SAJU_PROMPT_VERSION = 'gemini-premium-saju-2026-09-18-v5' as const;

export type ProseReleaseMode = 'strict-echo' | 'authored';

/**
 * 산문 권한이 열린 상품.
 *
 * **여기에 상품을 추가할 때는 프롬프트 분기도 같이 고쳐야 한다.** 코드만 열면
 * 모델이 echo 잠금을 계속 받으므로 새 문장을 안 쓰고, 프롬프트만 열면
 * 전 필드가 `base-mismatch` 로 거부돼 전 요청이 결정론으로 떨어진다(지금보다 나쁨).
 * 롤백도 같은 이유로 두 곳을 동시에 되돌려야 한다.
 */
export const AUTHORED_PROSE_SERVICE_IDS: readonly string[] = Object.freeze(['love-reunion']);

/**
 * 온도.
 *
 * `strict-echo` 상품은 **반드시 0 이어야 한다** — base 와 한 글자만 달라도
 * `base-mismatch` 로 100% 거부된다. 0.75 는 문체만 흔들고 사실 위험은
 * 3단 검증이 막지만, 형식(인용·배열 길이) 준수율이 떨어지면 대가는 문장이 아니라
 * 필드 하나다. 거부율이 오르면 프롬프트 수정보다 0.5 로 내려 보는 쪽이 싸다.
 */
export const LOVE_REUNION_PROSE_TEMPERATURE = 0.75;
export const STRICT_ECHO_PROSE_TEMPERATURE = 0;

export function proseGuardModeForServiceId(serviceId: string): ProseReleaseMode {
  return AUTHORED_PROSE_SERVICE_IDS.includes(serviceId) ? 'authored' : 'strict-echo';
}

export function proseTemperatureForServiceId(serviceId: string): number {
  return serviceId === 'love-reunion' ? LOVE_REUNION_PROSE_TEMPERATURE : STRICT_ECHO_PROSE_TEMPERATURE;
}
