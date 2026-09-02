import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const artifactDir = new URL('../artifacts/golden-source-cache/', import.meta.url);
const bundleUrl = new URL('expert-blind-review.bundle.mjs', artifactDir);
const outputUrl = new URL('../docs/GENERAL_SIGNATURE_EXPERT_BLIND_REVIEW_50.csv', import.meta.url);

await mkdir(artifactDir, { recursive: true });
await build({
  entryPoints: [fileURLToPath(new URL('../src/lib/saju/golden/expertBlindReview.ts', import.meta.url))],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: fileURLToPath(bundleUrl),
  logLevel: 'silent'
});

const review = await import(`${pathToFileURL(fileURLToPath(bundleUrl)).href}?t=${Date.now()}`);
const fixtureBundleUrl = new URL('golden-fixtures.bundle.mjs', artifactDir);
await build({
  entryPoints: [fileURLToPath(new URL('../src/lib/saju/golden/fixtures.ts', import.meta.url))],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: fileURLToPath(fixtureBundleUrl),
  logLevel: 'silent'
});
const fixtureSource = await import(`${pathToFileURL(fileURLToPath(fixtureBundleUrl)).href}?t=${Date.now()}`);
const rows = review.createExpertBlindReviewRows(fixtureSource.generalSignatureGoldenFixtures);
const headers = Object.keys(rows[0]);
const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
const csv = [headers.map(quote).join(','), ...rows.map((row) => headers.map((key) => quote(row[key])).join(','))].join('\n');
await writeFile(outputUrl, `\ufeff${csv}\n`, 'utf8');
console.log(`Exported ${rows.length} blind-review rows to ${fileURLToPath(outputUrl)}`);
