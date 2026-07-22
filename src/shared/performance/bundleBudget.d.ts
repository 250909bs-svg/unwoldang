export type BundleAssetType = 'js' | 'css';

export interface BundleMetricLimits {
  totalRawBytes: number;
  totalGzipBytes: number;
  maxRawBytes: number;
  maxGzipBytes: number;
}

export type BundleLimits = Readonly<Record<BundleAssetType, Readonly<BundleMetricLimits>>>;

export interface BundleAssetMeasurement {
  file: string;
  type: BundleAssetType;
  rawBytes: number;
  gzipBytes: number;
}

export interface BundleAssetSummary extends BundleMetricLimits {
  fileCount: number;
  largestRawFile: string | null;
  largestGzipFile: string | null;
}

export interface BundleMeasurement {
  assetsDirectory: string;
  files: BundleAssetMeasurement[];
  js: BundleAssetSummary;
  css: BundleAssetSummary;
}

export interface BundleBudgetViolation {
  assetType: BundleAssetType;
  metric: keyof BundleMetricLimits;
  label: string;
  actualBytes: number;
  budgetBytes: number;
  overByBytes: number;
}

export interface BundleBudgetReport {
  ok: boolean;
  budget: BundleLimits;
  measurement: BundleMeasurement;
  violations: BundleBudgetViolation[];
}

export declare const BUNDLE_BASELINE_BYTES: BundleLimits;
export declare const BUNDLE_BUDGET_BYTES: BundleLimits;

export declare class BundleMeasurementError extends Error {
  readonly code: 'ASSETS_DIRECTORY_NOT_FOUND' | 'ASSETS_DIRECTORY_READ_FAILED' | 'NO_BUNDLE_ASSETS';
}

export declare function classifyBundleAsset(fileName: string): BundleAssetType | null;
export declare function measureBundleAssets(assetsDirectory: string): Promise<BundleMeasurement>;
export declare function evaluateBundleBudget(
  measurement: BundleMeasurement,
  budget?: BundleLimits
): BundleBudgetReport;
export declare function createBundleBudgetReport(
  assetsDirectory: string,
  budget?: BundleLimits
): Promise<BundleBudgetReport>;
export declare function formatByteCount(bytes: number): string;
export declare function renderBundleBudgetReport(report: BundleBudgetReport): string;
