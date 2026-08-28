import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import MatchCoupleAwareReportRoute, { isLegacyMatchCoupleReportState } from './ReportRoute';

const LegacyRenderer = () => createElement('div', { 'data-renderer': 'legacy-report' });
const MatchCoupleRenderer = () => createElement('div', { 'data-renderer': 'match-couple-report' });

const validLegacyArchiveState = {
  orderId: 'UW-legacy-match-couple-001',
  formData: {
    name: '본인',
    birthDate: '1990-01-01',
    partner: { name: '상대방', birthDate: '1991-02-02' }
  },
  reportData: {
    serviceId: 'match-couple',
    serialNumber: 'legacy-serial',
    title: '기존 사주궁합 리포트',
    customerName: '본인',
    createdAt: '2025-01-01T00:00:00.000Z',
    sections: [],
    keyTakeaways: [],
    yearLuck: [],
    monthLuck: [],
    pillars: {}
  }
};

function renderReportRoute(pathname: string, state: unknown) {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [{ pathname, state }] },
      createElement(
        Routes,
        null,
        createElement(Route, {
          path: '/report/:id',
          element: createElement(MatchCoupleAwareReportRoute, {
            legacyRenderer: LegacyRenderer,
            matchCoupleRenderer: MatchCoupleRenderer
          })
        })
      )
    )
  );
}

describe('match-couple report route compatibility', () => {
  it('delegates a valid legacy paid archive to the original generic report renderer', () => {
    expect(isLegacyMatchCoupleReportState('match-couple', validLegacyArchiveState)).toBe(true);

    const html = renderReportRoute('/report/match-couple', validLegacyArchiveState);
    expect(html).toContain('data-renderer="legacy-report"');
    expect(html).not.toContain('data-renderer="match-couple-report"');
  });

  it('does not trust a malformed embedded model as a dedicated archive', () => {
    const state = {
      ...validLegacyArchiveState,
      reportData: {
        ...validLegacyArchiveState.reportData,
        matchCoupleModel: { version: 'future-or-corrupt' }
      }
    };

    expect(isLegacyMatchCoupleReportState('match-couple', state)).toBe(true);
    expect(renderReportRoute('/report/match-couple', state)).toContain('data-renderer="legacy-report"');
  });

  it('uses the dedicated renderer when product-local context is present', () => {
    const state = {
      ...validLegacyArchiveState,
      formData: {
        ...validLegacyArchiveState.formData,
        matchCoupleContext: { version: 'match-couple-v1' }
      }
    };

    expect(renderReportRoute('/report/match-couple', state)).toContain('data-renderer="match-couple-report"');
  });

  it('leaves every other product on the original generic report renderer', () => {
    expect(renderReportRoute('/report/general-signature', validLegacyArchiveState)).toContain(
      'data-renderer="legacy-report"'
    );
  });
});
