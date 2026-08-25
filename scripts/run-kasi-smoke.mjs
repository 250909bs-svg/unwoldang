import { spawnSync } from 'node:child_process';
import process from 'node:process';

const legacyKey = process.env.KASI_SERVICE_KEY
  || process.env.DATA_GO_KR_SERVICE_KEY
  || process.env.PUBLIC_DATA_SERVICE_KEY;
const lunarConfigured = Boolean(process.env.KASI_LUNAR_SERVICE_KEY || legacyKey);
const specialDayConfigured = Boolean(process.env.KASI_SPECIALDAY_SERVICE_KEY || legacyKey);

console.log(`KASI smoke capabilities: lunar=${lunarConfigured}, specialDay=${specialDayConfigured}`);

const result = spawnSync(
  process.execPath,
  [
    './node_modules/vitest/vitest.mjs',
    'run',
    'src/lib/server/kasiCalendarService.smoke.test.ts'
  ],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      KASI_LUNAR_SMOKE_TEST: lunarConfigured ? '1' : '0',
      KASI_SPECIALDAY_SMOKE_TEST: specialDayConfigured ? '1' : '0'
    },
    stdio: 'inherit'
  }
);

if (result.error) {
  console.error(`KASI smoke test could not start: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
