import type { AuthUser } from './model';

/**
 * 로컬 미리보기에서는 카카오 로그인 없이 바로 화면을 본다.
 *
 * 켜지는 조건은 두 가지가 모두 참일 때뿐이다.
 *   1) 개발 빌드(import.meta.env.DEV)
 *   2) 루프백 호스트 — 개발 빌드를 사내망에 띄워도 남이 남의 계정으로 들어오지 않는다.
 *
 * 배포 번들에도 이 함수와 아래 상수는 그대로 남는다(트리셰이킹되지 않는다). 다만 기본 인자의
 * `import.meta.env.DEV` 가 `false` 로 접히므로 `!!isDevelopment && …` 가 항상 false 다.
 * 실측: 프로덕션 번들에 `isDevelopment:!1` 로 들어간다. 호출부가 인자를 넘기지 않는 한
 * Vercel 이나 Cloud Run 에 올라간 빌드에서 참이 될 수 없다 — 인자를 넘기는 곳은 테스트뿐이다.
 */
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function isLoopbackHostname(hostname?: string) {
  return LOOPBACK_HOSTNAMES.has((hostname || '').trim().toLowerCase());
}

export function isLocalPreviewAuthEnabled(
  runtime: { isDevelopment?: boolean; hostname?: string } = {
    isDevelopment: import.meta.env.DEV,
    hostname: typeof window === 'undefined' ? undefined : window.location.hostname
  }
) {
  return Boolean(runtime.isDevelopment) && isLoopbackHostname(runtime.hostname);
}

/**
 * id 를 고정한다. `demo-${Date.now()}` 였다면 StrictMode 의 이중 초기화와 새로고침마다
 * 다른 사용자가 되어 draftOwnerId 로 묶인 입력 초안이 매번 남의 것이 된다.
 */
export const LOCAL_PREVIEW_USER_ID = 'demo-local-preview';

export const createLocalPreviewUser = (connectedAt: string): AuthUser => ({
  id: LOCAL_PREVIEW_USER_ID,
  nickname: '로컬 미리보기',
  provider: 'demo',
  connectedAt
});
