/// <reference types="vite/client" />

/**
 * React 18 런타임은 camelCase `fetchPriority` 를 모른다. 넘기면 콘솔에
 * "React does not recognize the fetchPriority prop" 경고를 찍는다(소문자로 렌더되긴 한다).
 * 반대로 @types/react 18 은 소문자 `fetchpriority` 를 모른다.
 *
 * 그래서 소문자를 쓰고 타입만 열어 준다. React 19 로 올리면 camelCase 가 정식 지원되므로
 * 이 선언과 호출부를 함께 되돌린다.
 */
declare namespace React {
  interface ImgHTMLAttributes<T> {
    fetchpriority?: 'high' | 'low' | 'auto';
  }
}

interface ImportMetaEnv {
  readonly VITE_KAKAO_REST_API_KEY?: string;
  readonly VITE_KAKAO_TOKEN_EXCHANGE_ENDPOINT?: string;
  readonly VITE_KAKAO_SCOPES?: string;
  readonly VITE_PUBLIC_SITE_URL?: string;
  readonly VITE_PORTONE_STORE_ID?: string;
  readonly VITE_PORTONE_CHANNEL_KEY?: string;
  readonly VITE_PORTONE_CONFIRM_ENDPOINT?: string;
  readonly VITE_PORTONE_DEFAULT_PHONE_NUMBER?: string;
  readonly VITE_PORTONE_DEFAULT_EMAIL?: string;
  readonly VITE_ENABLE_CLIENT_ADMIN?: string;
  readonly VITE_LOCAL_ADMIN_CREDENTIAL_HASH?: string;
  readonly VITE_REPORT_ENDPOINT?: string;
  readonly VITE_GUIYEONDO_API_BASE_URL?: string;
  readonly VITE_RELEASE_PREFLIGHT_ENDPOINT?: string;
  readonly VITE_REPORT_ARCHIVE_ENDPOINT?: string;
  readonly VITE_ADMIN_LOGIN_ENDPOINT?: string;
  readonly VITE_ADMIN_REPORTS_ENDPOINT?: string;
  readonly VITE_REPORT_TIMEOUT_MS?: string;
  readonly VITE_OPENAI_REPORT_ENDPOINT?: string;
  readonly VITE_PAYMENT_MODE?: 'demo' | 'test' | 'live';
  readonly VITE_PAYMENT_PROVIDER?: 'disabled' | 'hyphen' | 'legacy-portone';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
