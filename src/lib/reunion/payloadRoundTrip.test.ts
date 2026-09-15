import { describe, expect, it } from 'vitest';
import { findServiceById } from '../../api/mockData';
import { buildAnalysisRequestPayload } from '../analysisPayload';
import { normalizeIntakeFormData } from '../intakeDataContract';
import { getProductByRoute } from '../../products/registry';
import { REUNION_CONTEXT_VERSION, type ReunionContext } from './index';

const context: ReunionContext = {
  schemaVersion: REUNION_CONTEXT_VERSION,
  breakupDuration: 'sixTo12m',
  contactStatus: 'no-contact',
  lastContactAt: '2026-01-02',
  breakupReason: '서로의 생활 리듬이 달랐어요.',
  desiredOutcome: 'reconnect',
  notes: '현실에서 확인할 행동이 궁금해요.',
  consentToUsePartnerData: true
};

describe('reunion product and payload contract', () => {
  it('registers the 990-won two-person product and its preview route', () => {
    const product = getProductByRoute('/preview/love-reunion');
    expect(product).toMatchObject({
      id: 'love-reunion',
      price: 990,
      flow: { requiresPartnerBirth: true }
    });
    expect(findServiceById('love-reunion').price).toBe('990원');
  });

  it('preserves reunion context through intake normalization and the analysis payload', () => {
    const normalized = normalizeIntakeFormData({
      gender: 'female',
      relationshipStatus: 'breakup-reunion',
      relationshipDuration: '',
      reunionContext: context
    });
    const payload = buildAnalysisRequestPayload('love-reunion', normalized);

    expect(normalized.reunionContext).toEqual(context);
    expect(payload.reunionContext).toEqual(context);
    expect(payload.pastLifeContext).toBeNull();
  });

  it('does not leak reunion context into another product payload', () => {
    const payload = buildAnalysisRequestPayload('general-signature', {
      gender: 'female',
      reunionContext: context
    });
    expect(payload.reunionContext).toBeNull();
  });
});
