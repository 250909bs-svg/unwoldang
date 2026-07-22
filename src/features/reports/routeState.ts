import type { ReportGenerationMetaV1 } from './contracts';

export type ReportGenerationRouteState = {
  reportGenerationMeta?: ReportGenerationMetaV1;
  reportDegraded?: boolean;
};

export function resolveReportDegradedState(input: {
  reportDegraded?: boolean;
  reportGenerationMeta?: ReportGenerationMetaV1;
  reportProvider?: string | null;
}) {
  if (typeof input.reportDegraded === 'boolean') {
    return input.reportDegraded;
  }
  if (input.reportGenerationMeta) {
    return input.reportGenerationMeta.fallback;
  }
  return input.reportProvider === 'deterministic-fallback';
}
