import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const outDir = new URL('../artifacts/golden-source-cache/', import.meta.url);
const bundleUrl = new URL('golden-fixtures.bundle.mjs', outDir);
const targetUrl = new URL('golden-fixture-targets.json', outDir);

await mkdir(outDir, { recursive: true });
await build({
  entryPoints: [fileURLToPath(new URL('../src/lib/saju/golden/fixtures.ts', import.meta.url))],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: fileURLToPath(bundleUrl),
  logLevel: 'silent'
});

const source = await import(`${pathToFileURL(fileURLToPath(bundleUrl)).href}?t=${Date.now()}`);
const targets = source.generalSignatureGoldenFixtures.map(({ id, category, input }) => ({
  id,
  category,
  input
}));

await writeFile(targetUrl, `${JSON.stringify(targets, null, 2)}\n`, 'utf8');
console.log(`Exported ${targets.length} immutable golden fixture inputs to ${fileURLToPath(targetUrl)}`);
