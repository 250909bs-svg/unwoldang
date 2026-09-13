import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const outDir = new URL('../artifacts/time-dayun-audit/', import.meta.url);
const reportUrl = new URL('time-dayun-audit-report.json', outDir);

await mkdir(outDir, { recursive: true });
const bundle = await build({
  stdin: {
    contents: `
      import { evaluateTimeAndDayunAudit } from '../../src/lib/saju/golden/timeDayunAudit.ts';
      console.log(JSON.stringify(evaluateTimeAndDayunAudit()));
    `,
    resolveDir: fileURLToPath(outDir),
    sourcefile: 'time-dayun-audit-entry.ts'
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  logLevel: 'silent'
});

const encoded = Buffer.from(bundle.outputFiles[0].text).toString('base64');
const originalLog = console.log;
let reportText = '';
console.log = (value) => { reportText = String(value); };
await import(`data:text/javascript;base64,${encoded}`);
console.log = originalLog;

const report = JSON.parse(reportText);
await writeFile(reportUrl, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  hourBranch: `${report.hourBranch.matches}/${report.hourBranch.total}`,
  hourStem: `${report.hourStem.matches}/${report.hourStem.total}`,
  lateZiDay: `${report.lateZi.dayMatches}/${report.lateZi.total}`,
  lateZiHour: `${report.lateZi.hourMatches}/${report.lateZi.total}`,
  lateZiPolicyDifferences: report.lateZi.policyDifferences,
  dayunDirection: `${report.dayun.directionMatches}/${report.dayun.total}`,
  firstDayun: `${report.dayun.firstDayunMatches}/${report.dayun.total}`,
  startsAtPolicyDifferences: report.dayun.startsAtPolicyDifferences,
  startsAtMaxAbsDeltaSeconds: report.dayun.startsAtMaxAbsDeltaSeconds,
  timezoneDst: report.timezoneDst
}, null, 2));
console.log(`Report: ${fileURLToPath(reportUrl)}`);
