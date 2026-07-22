import {
  REPORT_GENERATION_META_SCHEMA_VERSION,
  REPORT_REQUEST_SCHEMA_VERSION,
  REPORT_RESPONSE_SCHEMA_VERSION,
  parseReportResponseV1,
  type ReportResponseV1
} from '../../../../src/features/reports/contracts.ts';
import {
  REPORT_ERROR_CODE,
  ReportPlatformError
} from '../../contracts/errors.ts';

export const REPORT_CACHE_SCHEMA_VERSION = 'report-cache-v1' as const;

export type ReportCacheStatus = 'hit' | 'miss' | 'bypass' | 'unknown';

function responseFailure(error: unknown): never {
  throw new ReportPlatformError({
    status: 502,
    code: REPORT_ERROR_CODE.RESPONSE_INVALID,
    message: 'The report generator returned an invalid response.',
    retryable: true,
    cause: error
  });
}

function validate(value: unknown) {
  try {
    return parseReportResponseV1(value);
  } catch (error) {
    return responseFailure(error);
  }
}

function upgradeLegacyReportData(report: ReportResponseV1['report']): ReportResponseV1['report'] {
  const source = report as unknown as Record<string, unknown>;
  if (typeof source.summary !== 'string') return report;
  return {
    ...report,
    summary: {
      title: source.summary,
      analysis: [],
      advice: []
    }
  };
}

export function normalizeGeneratedReport(
  value: unknown,
  input: {
    model: string | null;
    latencyMs: number;
    attemptCount: number;
    cacheStatus: ReportCacheStatus;
    reportMode: string;
    promptVersion: string;
  }
): ReportResponseV1 {
  const parsed = validate(value);
  const provider = parsed.provider;
  const fallback = provider !== 'gemini' || parsed.generationMeta.fallback;
  const normalized: ReportResponseV1 = {
    schemaVersion: REPORT_RESPONSE_SCHEMA_VERSION,
    report: upgradeLegacyReportData(parsed.report),
    provider,
    reportMode: parsed.reportMode || input.reportMode,
    promptVersion: parsed.promptVersion || input.promptVersion,
    generationMeta: {
      ...parsed.generationMeta,
      schemaVersion: REPORT_GENERATION_META_SCHEMA_VERSION,
      provider,
      model: parsed.generationMeta.model ?? input.model,
      latencyMs: parsed.generationMeta.latencyMs ?? input.latencyMs,
      attemptCount: parsed.generationMeta.attemptCount,
      fallback,
      ...(fallback
        ? {
            fallbackReason:
              parsed.generationMeta.fallbackReason ||
              (provider === 'deterministic-fallback'
                ? 'deterministic-fallback'
                : 'provider-unknown')
          }
        : { fallbackReason: undefined }),
      cacheStatus: input.cacheStatus,
      inputSchemaVersion: REPORT_REQUEST_SCHEMA_VERSION,
      responseSchemaVersion: REPORT_RESPONSE_SCHEMA_VERSION
    }
  };

  return validate(normalized);
}

export function parseCachedReport(
  value: unknown,
  options: { allowLegacy: boolean }
): ReportResponseV1 {
  try {
    const isVersioned = Boolean(
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      (value as Record<string, unknown>).schemaVersion === REPORT_RESPONSE_SCHEMA_VERSION
    );
    if (!options.allowLegacy && !isVersioned) {
      throw new Error('Versioned cache metadata requires a versioned response payload.');
    }
    const parsed = parseReportResponseV1(value);
    return parseReportResponseV1({
      ...parsed,
      report: upgradeLegacyReportData(parsed.report),
      generationMeta: {
        ...parsed.generationMeta,
        cacheStatus: 'hit'
      }
    });
  } catch (error) {
    throw new ReportPlatformError({
      status: 503,
      code: REPORT_ERROR_CODE.CACHE_INVALID,
      message: 'The saved report cache has an invalid response schema.',
      retryable: true,
      cause: error
    });
  }
}

export const REPORT_CACHE_VERSION_FIELDS = Object.freeze({
  cacheSchemaVersion: REPORT_CACHE_SCHEMA_VERSION,
  inputSchemaVersion: REPORT_REQUEST_SCHEMA_VERSION,
  responseSchemaVersion: REPORT_RESPONSE_SCHEMA_VERSION,
  generationMetaSchemaVersion: REPORT_GENERATION_META_SCHEMA_VERSION
});
