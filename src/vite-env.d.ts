/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_KAKAO_REST_API_KEY?: string;
  readonly VITE_KAKAO_TOKEN_EXCHANGE_ENDPOINT?: string;
  readonly VITE_TOSSPAYMENTS_CLIENT_KEY?: string;
  readonly VITE_TOSSPAYMENTS_CONFIRM_ENDPOINT?: string;
  readonly VITE_REPORT_ENDPOINT?: string;
  readonly VITE_OPENAI_REPORT_ENDPOINT?: string;
  readonly VITE_PAYMENT_MODE?: 'demo' | 'test' | 'live';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
