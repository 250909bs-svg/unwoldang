import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const mockBaseUrl = 'http://127.0.0.1:42714';
const viteBin = fileURLToPath(new URL('../../node_modules/vite/bin/vite.js', import.meta.url));

const child = spawn(
  process.execPath,
  [viteBin, '--host', '127.0.0.1', '--port', '42713', '--strictPort'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_PAYMENT_MODE: 'live',
      VITE_KAKAO_REST_API_KEY: 'e2e-fake-kakao-rest-key',
      VITE_KAKAO_REDIRECT_ORIGIN: 'http://127.0.0.1:42713',
      VITE_KAKAO_TOKEN_EXCHANGE_ENDPOINT: `${mockBaseUrl}/api/auth/kakao/exchange`,
      VITE_PORTONE_STORE_ID: 'e2e-fake-portone-store',
      VITE_PORTONE_CHANNEL_KEY: 'e2e-fake-portone-channel',
      VITE_PORTONE_DEFAULT_EMAIL: 'fixture.user@example.invalid',
      VITE_PORTONE_DEFAULT_PHONE_NUMBER: '01000000000',
      VITE_PORTONE_CONFIRM_ENDPOINT: `${mockBaseUrl}/api/payments/portone/confirm`,
      VITE_REPORT_ENDPOINT: `${mockBaseUrl}/api/report`,
      VITE_REPORT_ARCHIVE_ENDPOINT: `${mockBaseUrl}/api/archive/reports`,
      VITE_ADMIN_LOGIN_ENDPOINT: `${mockBaseUrl}/api/admin/login`,
      VITE_ADMIN_REPORTS_ENDPOINT: `${mockBaseUrl}/api/admin/reports`,
    },
  },
);

const stop = (signal) => {
  if (!child.killed) {
    child.kill(signal);
  }
};

process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));
child.once('error', (error) => {
  console.error('[e2e:dev-server] Failed to start Vite.', error);
  process.exitCode = 1;
});
child.once('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 1;
});
