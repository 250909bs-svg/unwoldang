import type {
  ReportErrorCode,
  ReportGenerationMetaV1
} from '../../../../src/features/reports/contracts.ts';

export const REPORT_TELEMETRY_KEYS = Object.freeze([
  'productId',
  'schemaVersion',
  'provider',
  'model',
  'latencyMs',
  'attemptCount',
  'inputTokens',
  'outputTokens',
  'totalTokens',
  'estimatedCostMicros',
  'currency',
  'fallback',
  'fallbackReason',
  'cacheStatus',
  'errorCode',
  'inputSchemaVersion',
  'responseSchemaVersion',
  'engineVersion',
  'adapterVersion'
] as const);

export type ReportGenerationTelemetryEvent = Readonly<{
  productId: string;
  schemaVersion: ReportGenerationMetaV1['schemaVersion'];
  provider: string;
  model: string | null;
  latencyMs: number | null;
  attemptCount: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCostMicros: number | null;
  currency: 'USD';
  fallback: boolean;
  fallbackReason?: string;
  cacheStatus: string;
  errorCode?: ReportErrorCode;
  inputSchemaVersion: ReportGenerationMetaV1['inputSchemaVersion'];
  responseSchemaVersion: ReportGenerationMetaV1['responseSchemaVersion'];
  engineVersion?: string;
  adapterVersion?: string;
}>;

export type ReportTelemetrySink = (
  event: ReportGenerationTelemetryEvent
) => void | Promise<void>;

/**
 * Copies an explicit allowlist so request, identity, payment, and token data
 * cannot be forwarded even when the caller passes a wider source object.
 */
export function createPrivacySafeReportTelemetryEvent(input: {
  productId: string;
  generationMeta: ReportGenerationMetaV1;
}): ReportGenerationTelemetryEvent {
  const { productId, generationMeta } = input;

  return Object.freeze({
    productId,
    schemaVersion: generationMeta.schemaVersion,
    provider: generationMeta.provider,
    model: generationMeta.model,
    latencyMs: generationMeta.latencyMs,
    attemptCount: generationMeta.attemptCount,
    inputTokens: generationMeta.inputTokens,
    outputTokens: generationMeta.outputTokens,
    totalTokens: generationMeta.totalTokens,
    estimatedCostMicros: generationMeta.estimatedCostMicros,
    currency: generationMeta.currency,
    fallback: generationMeta.fallback,
    ...(generationMeta.fallbackReason
      ? { fallbackReason: generationMeta.fallbackReason }
      : {}),
    cacheStatus: generationMeta.cacheStatus,
    ...(generationMeta.errorCode ? { errorCode: generationMeta.errorCode } : {}),
    inputSchemaVersion: generationMeta.inputSchemaVersion,
    responseSchemaVersion: generationMeta.responseSchemaVersion,
    ...(generationMeta.engineVersion
      ? { engineVersion: generationMeta.engineVersion }
      : {}),
    ...(generationMeta.adapterVersion
      ? { adapterVersion: generationMeta.adapterVersion }
      : {})
  });
}

export const noopReportTelemetry: ReportTelemetrySink = () => undefined;
