import { describe, expect, it } from 'vitest';
import {
  REUNION_CONTEXT_VERSION,
  createEmptyReunionContext,
  normalizeReunionContext,
  validateReunionContext,
  type ReunionContext
} from './index';

const validContext: ReunionContext = {
  schemaVersion: REUNION_CONTEXT_VERSION,
  breakupDuration: 'oneTo3m',
  contactStatus: 'occasional',
  lastContactAt: '2026-08-31',
  breakupReason: '대화 방식이 자주 엇갈렸어요.',
  desiredOutcome: 'clarity',
  notes: '서로 두 번 정도 안부를 물었어요.',
  consentToUsePartnerData: true
};

describe('reunion context validation', () => {
  it('normalizes text while preserving explicit unknown values', () => {
    expect(normalizeReunionContext({
      ...validContext,
      breakupDuration: 'unknown',
      contactStatus: 'unknown',
      breakupReason: '  대화가 끊겼어요.  ',
      notes: '  확실하지 않은 기억  '
    })).toEqual({
      ...validContext,
      breakupDuration: 'unknown',
      contactStatus: 'unknown',
      breakupReason: '대화가 끊겼어요.',
      notes: '확실하지 않은 기억'
    });
  });

  it('returns field-level errors for malformed dates, missing context, and absent consent', () => {
    const result = validateReunionContext({
      ...createEmptyReunionContext(),
      breakupDuration: 'soon',
      lastContactAt: '2026-02-31'
    });

    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.field)).toEqual(expect.arrayContaining([
      'breakupDuration',
      'lastContactAt',
      'breakupReason',
      'consentToUsePartnerData'
    ]));
  });

  it('rejects unsupported schema versions instead of silently migrating them', () => {
    expect(normalizeReunionContext({ ...validContext, schemaVersion: 'reunion-context-v99' })).toBeNull();
    expect(validateReunionContext({ ...validContext, schemaVersion: 'reunion-context-v99' })).toMatchObject({
      valid: false,
      errors: [{ field: 'schemaVersion' }]
    });
  });

  it('accepts the canonical complete context', () => {
    expect(validateReunionContext(validContext)).toEqual({ valid: true, errors: [] });
  });
});
