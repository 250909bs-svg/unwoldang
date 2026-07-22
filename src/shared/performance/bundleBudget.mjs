import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

export const BUNDLE_BASELINE_BYTES = Object.freeze({
  js: Object.freeze({
    totalRawBytes: 1_241_134,
    totalGzipBytes: 414_134,
    maxRawBytes: 313_016,
    maxGzipBytes: 98_863
  }),
  css: Object.freeze({
    totalRawBytes: 575_220,
    totalGzipBytes: 107_446,
    maxRawBytes: 346_129,
    maxGzipBytes: 61_191
  })
});

// Keep the allowance close to five percent so routine UI work has room without
// hiding a meaningful bundle regression. See README.md for the measured baseline.
export const BUNDLE_BUDGET_BYTES = Object.freeze({
  js: Object.freeze({
    totalRawBytes: 1_304_000,
    totalGzipBytes: 435_000,
    maxRawBytes: 329_000,
    maxGzipBytes: 104_000
  }),
  css: Object.freeze({
    totalRawBytes: 604_000,
    totalGzipBytes: 113_000,
    maxRawBytes: 369_000,
    maxGzipBytes: 66_000
  })
});

const ASSET_TYPES = Object.freeze(['js', 'css']);
const METRICS = Object.freeze([
  Object.freeze({ key: 'totalRawBytes', label: 'total raw' }),
  Object.freeze({ key: 'totalGzipBytes', label: 'total gzip' }),
  Object.freeze({ key: 'maxRawBytes', label: 'largest raw chunk' }),
  Object.freeze({ key: 'maxGzipBytes', label: 'largest gzip chunk' })
]);

export class BundleMeasurementError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = 'BundleMeasurementError';
    this.code = code;
  }
}

export function classifyBundleAsset(fileName) {
  const extension = extname(fileName).toLowerCase();

  if (extension === '.js') {
    return 'js';
  }

  if (extension === '.css') {
    return 'css';
  }

  return null;
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

function toPortableRelativePath(rootDirectory, filePath) {
  return relative(rootDirectory, filePath).split(sep).join('/');
}

function summarizeAssets(files, assetType) {
  const matchingFiles = files.filter((file) => file.type === assetType);
  const largestRaw = matchingFiles.reduce(
    (largest, file) => (largest === null || file.rawBytes > largest.rawBytes ? file : largest),
    null
  );
  const largestGzip = matchingFiles.reduce(
    (largest, file) => (largest === null || file.gzipBytes > largest.gzipBytes ? file : largest),
    null
  );

  return {
    fileCount: matchingFiles.length,
    totalRawBytes: matchingFiles.reduce((total, file) => total + file.rawBytes, 0),
    totalGzipBytes: matchingFiles.reduce((total, file) => total + file.gzipBytes, 0),
    maxRawBytes: largestRaw?.rawBytes ?? 0,
    maxGzipBytes: largestGzip?.gzipBytes ?? 0,
    largestRawFile: largestRaw?.file ?? null,
    largestGzipFile: largestGzip?.file ?? null
  };
}

export async function measureBundleAssets(assetsDirectory) {
  const resolvedDirectory = resolve(assetsDirectory);
  let discoveredFiles;

  try {
    discoveredFiles = await collectFiles(resolvedDirectory);
  } catch (error) {
    if (error && typeof error === 'object' && ('code' in error) &&
        (error.code === 'ENOENT' || error.code === 'ENOTDIR')) {
      throw new BundleMeasurementError(
        'ASSETS_DIRECTORY_NOT_FOUND',
        `Bundle assets directory was not found: ${resolvedDirectory}`,
        { cause: error }
      );
    }

    throw new BundleMeasurementError(
      'ASSETS_DIRECTORY_READ_FAILED',
      `Bundle assets directory could not be read: ${resolvedDirectory}`,
      { cause: error }
    );
  }

  const candidateFiles = discoveredFiles
    .map((filePath) => ({ filePath, type: classifyBundleAsset(filePath) }))
    .filter((candidate) => candidate.type !== null);

  if (candidateFiles.length === 0) {
    throw new BundleMeasurementError(
      'NO_BUNDLE_ASSETS',
      `No JavaScript or CSS assets were found in: ${resolvedDirectory}`
    );
  }

  const files = await Promise.all(candidateFiles.map(async ({ filePath, type }) => {
    const contents = await readFile(filePath);

    return {
      file: toPortableRelativePath(resolvedDirectory, filePath),
      type,
      rawBytes: contents.byteLength,
      gzipBytes: gzipSync(contents).byteLength
    };
  }));

  files.sort((left, right) => left.file.localeCompare(right.file));

  return {
    assetsDirectory: resolvedDirectory,
    files,
    js: summarizeAssets(files, 'js'),
    css: summarizeAssets(files, 'css')
  };
}

export function evaluateBundleBudget(measurement, budget = BUNDLE_BUDGET_BYTES) {
  const violations = [];

  for (const assetType of ASSET_TYPES) {
    for (const metric of METRICS) {
      const actualBytes = measurement[assetType][metric.key];
      const budgetBytes = budget[assetType][metric.key];

      if (actualBytes > budgetBytes) {
        violations.push({
          assetType,
          metric: metric.key,
          label: metric.label,
          actualBytes,
          budgetBytes,
          overByBytes: actualBytes - budgetBytes
        });
      }
    }
  }

  return {
    ok: violations.length === 0,
    budget,
    measurement,
    violations
  };
}

export async function createBundleBudgetReport(
  assetsDirectory,
  budget = BUNDLE_BUDGET_BYTES
) {
  const measurement = await measureBundleAssets(assetsDirectory);
  return evaluateBundleBudget(measurement, budget);
}

export function formatByteCount(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KiB', 'MiB', 'GiB'];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function formatMetric(summary, budget, metric) {
  const actual = summary[metric.key];
  const limit = budget[metric.key];
  const status = actual <= limit ? 'PASS' : 'FAIL';
  return `  ${status} ${metric.label}: ${formatByteCount(actual)} / ${formatByteCount(limit)}`;
}

export function renderBundleBudgetReport(report) {
  const lines = [
    `Bundle budget ${report.ok ? 'PASS' : 'FAIL'}`,
    `Assets: ${report.measurement.assetsDirectory}`
  ];

  for (const assetType of ASSET_TYPES) {
    const summary = report.measurement[assetType];
    const budget = report.budget[assetType];
    lines.push('', `${assetType.toUpperCase()} (${summary.fileCount} files)`);

    for (const metric of METRICS) {
      lines.push(formatMetric(summary, budget, metric));
    }

    if (summary.largestRawFile !== null) {
      lines.push(`  largest raw file: ${summary.largestRawFile}`);
    }

    if (summary.largestGzipFile !== null) {
      lines.push(`  largest gzip file: ${summary.largestGzipFile}`);
    }
  }

  if (!report.ok) {
    lines.push('', 'Budget violations:');
    for (const violation of report.violations) {
      lines.push(
        `  - ${violation.assetType.toUpperCase()} ${violation.label} exceeds the limit by ` +
        formatByteCount(violation.overByBytes)
      );
    }
  }

  return lines.join('\n');
}
