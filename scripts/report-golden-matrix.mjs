import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const outDir = new URL('../artifacts/golden-source-cache/', import.meta.url);
const bundleUrl = new URL('golden-report.bundle.mjs', outDir);
const reportUrl = new URL('golden-matrix-report.json', outDir);
await mkdir(outDir, { recursive: true });
await build({
  stdin: {
    contents: `
      import { generalSignatureGoldenFixtures } from '../../src/lib/saju/golden/fixtures.ts';
      import { evaluateGoldenMatrix } from '../../src/lib/saju/golden/harness.ts';
      import { evaluateIndependentTables } from '../../src/lib/saju/golden/independentTableAudit.ts';
      export const report = {
        ...evaluateGoldenMatrix(generalSignatureGoldenFixtures),
        independentTables: evaluateIndependentTables()
      };
    `,
    resolveDir: fileURLToPath(outDir),
    sourcefile: 'golden-report-entry.ts',
    loader: 'ts'
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: fileURLToPath(bundleUrl),
  logLevel: 'silent'
});
const source = await import(`${pathToFileURL(fileURLToPath(bundleUrl)).href}?t=${Date.now()}`);
await writeFile(reportUrl, `${JSON.stringify(source.report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(source.report.summary, null, 2));
console.log(`Report: ${fileURLToPath(reportUrl)}`);
