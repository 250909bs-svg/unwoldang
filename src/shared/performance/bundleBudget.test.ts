import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  BundleMeasurementError,
  classifyBundleAsset,
  evaluateBundleBudget,
  measureBundleAssets,
  type BundleLimits,
  type BundleMeasurement
} from './bundleBudget.mjs';

const temporaryDirectories: string[] = [];

async function makeTemporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'unwoldang-bundle-budget-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )));
});

describe('bundle asset classification', () => {
  it.each([
    ['index-a1b2.js', 'js'],
    ['nested/route.CSS', 'css'],
    ['index.js.map', null],
    ['hero.webp', null]
  ] as const)('classifies %s as %s', (fileName, expected) => {
    expect(classifyBundleAsset(fileName)).toBe(expected);
  });
});

describe('bundle measurement', () => {
  it('measures raw and gzip bytes for JavaScript and CSS independently', async () => {
    const directory = await makeTemporaryDirectory();
    await writeFile(join(directory, 'app.js'), 'const repeated = "aaaaaaaaaaaaaaaa";\n'.repeat(20));
    await writeFile(join(directory, 'app.css'), '.card { color: rebeccapurple; }\n'.repeat(12));
    await writeFile(join(directory, 'ignored.map'), '{}');

    const measurement = await measureBundleAssets(directory);

    expect(measurement.js.fileCount).toBe(1);
    expect(measurement.css.fileCount).toBe(1);
    expect(measurement.files).toHaveLength(2);
    expect(measurement.js.totalRawBytes).toBeGreaterThan(measurement.js.totalGzipBytes);
    expect(measurement.css.maxRawBytes).toBe(measurement.css.totalRawBytes);
    expect(measurement.js.largestRawFile).toBe('app.js');
  });

  it('rejects an empty assets directory instead of reporting a false pass', async () => {
    const directory = await makeTemporaryDirectory();

    await expect(measureBundleAssets(directory)).rejects.toMatchObject({
      name: 'BundleMeasurementError',
      code: 'NO_BUNDLE_ASSETS'
    } satisfies Partial<BundleMeasurementError>);
  });
});

describe('bundle budget evaluation', () => {
  it('reports each metric that exceeds its configured budget', () => {
    const measurement: BundleMeasurement = {
      assetsDirectory: '/dist/assets',
      files: [],
      js: {
        fileCount: 1,
        totalRawBytes: 101,
        totalGzipBytes: 51,
        maxRawBytes: 81,
        maxGzipBytes: 41,
        largestRawFile: 'app.js',
        largestGzipFile: 'app.js'
      },
      css: {
        fileCount: 1,
        totalRawBytes: 90,
        totalGzipBytes: 45,
        maxRawBytes: 70,
        maxGzipBytes: 35,
        largestRawFile: 'app.css',
        largestGzipFile: 'app.css'
      }
    };
    const budget: BundleLimits = {
      js: {
        totalRawBytes: 100,
        totalGzipBytes: 50,
        maxRawBytes: 80,
        maxGzipBytes: 40
      },
      css: {
        totalRawBytes: 100,
        totalGzipBytes: 50,
        maxRawBytes: 80,
        maxGzipBytes: 40
      }
    };

    const report = evaluateBundleBudget(measurement, budget);

    expect(report.ok).toBe(false);
    expect(report.violations).toHaveLength(4);
    expect(report.violations.map(({ metric }) => metric)).toEqual([
      'totalRawBytes',
      'totalGzipBytes',
      'maxRawBytes',
      'maxGzipBytes'
    ]);
    expect(report.violations.every(({ assetType }) => assetType === 'js')).toBe(true);
  });

  it('passes when measurements equal their limits', () => {
    const limits: BundleLimits = {
      js: { totalRawBytes: 1, totalGzipBytes: 1, maxRawBytes: 1, maxGzipBytes: 1 },
      css: { totalRawBytes: 0, totalGzipBytes: 0, maxRawBytes: 0, maxGzipBytes: 0 }
    };
    const measurement: BundleMeasurement = {
      assetsDirectory: '/dist/assets',
      files: [],
      js: {
        fileCount: 1,
        ...limits.js,
        largestRawFile: 'app.js',
        largestGzipFile: 'app.js'
      },
      css: {
        fileCount: 0,
        ...limits.css,
        largestRawFile: null,
        largestGzipFile: null
      }
    };

    expect(evaluateBundleBudget(measurement, limits)).toMatchObject({
      ok: true,
      violations: []
    });
  });
});
