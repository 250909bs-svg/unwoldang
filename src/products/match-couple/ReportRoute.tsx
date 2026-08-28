import { lazy, type ComponentType } from 'react';
import { useLocation, useParams } from 'react-router-dom';

import { isMatchCoupleReportModel } from './modelValidation';
const LegacyReport = lazy(() => import('../../pages/Report'));
const MatchCoupleReport = lazy(() => import('./Report'));

type MatchCoupleReportRouteState = {
  formData?: {
    matchCoupleContext?: unknown;
  };
  reportData?: {
    serviceId?: unknown;
    matchCoupleModel?: unknown;
  };
};

type MatchCoupleReportRouteProps = {
  legacyRenderer?: ComponentType;
  matchCoupleRenderer?: ComponentType;
};

/**
 * Reports purchased before the dedicated match-couple module do not contain
 * its product-local context/model. Keep those paid artifacts on the renderer
 * that originally produced them instead of treating them as invalid input.
 */
export function isLegacyMatchCoupleReportState(
  productId: string | undefined,
  state: MatchCoupleReportRouteState | null
) {
  return Boolean(
    productId === 'match-couple' &&
      state?.reportData?.serviceId === 'match-couple' &&
      !isMatchCoupleReportModel(state.reportData.matchCoupleModel) &&
      !state.formData?.matchCoupleContext
  );
}

export default function MatchCoupleAwareReportRoute({
  legacyRenderer: LegacyRenderer = LegacyReport,
  matchCoupleRenderer: MatchCoupleRenderer = MatchCoupleReport
}: MatchCoupleReportRouteProps) {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const state = (location.state as MatchCoupleReportRouteState | null) ?? null;

  if (id !== 'match-couple' || isLegacyMatchCoupleReportState(id, state)) {
    return <LegacyRenderer />;
  }

  return <MatchCoupleRenderer />;
}
