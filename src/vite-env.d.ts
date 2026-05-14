/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_KAKAO_REST_API_KEY?: string;
  readonly VITE_KAKAO_TOKEN_EXCHANGE_ENDPOINT?: string;
  readonly VITE_KAKAO_SCOPES?: string;
  readonly VITE_PORTONE_STORE_ID?: string;
  readonly VITE_PORTONE_CHANNEL_KEY?: string;
  readonly VITE_PORTONE_CONFIRM_ENDPOINT?: string;
  readonly VITE_PORTONE_DEFAULT_PHONE_NUMBER?: string;
  readonly VITE_PORTONE_DEFAULT_EMAIL?: string;
  readonly VITE_ENABLE_CLIENT_ADMIN?: string;
  readonly VITE_LOCAL_ADMIN_CREDENTIAL_HASH?: string;
  readonly VITE_REPORT_ENDPOINT?: string;
  readonly VITE_REPORT_TIMEOUT_MS?: string;
  readonly VITE_OPENAI_REPORT_ENDPOINT?: string;
  readonly VITE_PAYMENT_MODE?: 'demo' | 'test' | 'live';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
