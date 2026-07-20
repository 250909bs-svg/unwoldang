import { describe, expect, it } from 'vitest';
import {
  canResumeArchivedIntake,
  hasNonEmptyReportAccessToken
} from './ProductFlowRouteBoundaries';

const validRecovery = {
  orderId: 'UW-123456789012',
  reportAccessToken: 'r'.repeat(40)
};

describe('archived product intake recovery policy', () => {
  it('allows a registered archived product only with a valid recovered entitlement shape', () => {
    expect(canResumeArchivedIntake('life-flow', validRecovery)).toBe(true);
  });

  it('rejects active, draft, and unknown products from the archived recovery exception', () => {
    expect(canResumeArchivedIntake('general-signature', validRecovery)).toBe(false);
    expect(canResumeArchivedIntake('unknown-product', validRecovery)).toBe(false);
  });

  it('rejects malformed order IDs and short report access tokens', () => {
    expect(
      canResumeArchivedIntake('life-flow', {
        ...validRecovery,
        orderId: 'not-a-payment-order'
      })
    ).toBe(false);
    expect(
      canResumeArchivedIntake('life-flow', {
        ...validRecovery,
        reportAccessToken: 'r'.repeat(39)
      })
    ).toBe(false);
  });
});

describe('historical loading token policy', () => {
  it('accepts only non-empty strings without invoking trim on untrusted values', () => {
    expect(hasNonEmptyReportAccessToken(' opaque-token ')).toBe(true);
    expect(hasNonEmptyReportAccessToken('   ')).toBe(false);
    expect(hasNonEmptyReportAccessToken(123)).toBe(false);
    expect(hasNonEmptyReportAccessToken({ trim: () => 'forged-token' })).toBe(false);
    expect(hasNonEmptyReportAccessToken(null)).toBe(false);
  });
});
