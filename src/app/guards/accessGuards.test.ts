import { describe, expect, it } from 'vitest';
import {
  ACCESS_DENIAL_CODES,
  decideAdminRequiredAccess,
  decideLoginRequiredAccess,
  decidePaymentReportRequiredAccess,
  type ServerAdminSessionDecision,
  type ServerPaymentReportAccessDecision
} from './accessGuards';

describe('login-required access', () => {
  it.each([
    [false, { allowed: false, denialCode: ACCESS_DENIAL_CODES.LOGIN_REQUIRED }],
    [true, { allowed: true, grant: 'authenticated-navigation', authority: 'client-navigation-state' }]
  ] as const)('decides authenticated=%s', (isAuthenticated, expected) => {
    expect(decideLoginRequiredAccess(isAuthenticated)).toMatchObject(expected);
  });
});

describe('server payment/report-access required', () => {
  const cases: ReadonlyArray<
    readonly [string, ServerPaymentReportAccessDecision | null, Readonly<Record<string, unknown>>]
  > = [
    [
      'without server verification',
      null,
      {
        allowed: false,
        denialCode: ACCESS_DENIAL_CODES.PAYMENT_REPORT_SERVER_VERIFICATION_REQUIRED
      }
    ],
    [
      'after a server denial',
      { status: 'denied' },
      { allowed: false, denialCode: ACCESS_DENIAL_CODES.PAYMENT_REPORT_ACCESS_DENIED }
    ],
    [
      'with a server-verified payment entitlement',
      { status: 'verified', mode: 'payment-entitlement' },
      { allowed: true, grant: 'payment-entitlement', authority: 'server' }
    ],
    [
      'with a server-verified archive replay',
      { status: 'verified', mode: 'archive-replay' },
      { allowed: true, grant: 'archive-replay', authority: 'server' }
    ]
  ];

  it.each(cases)('%s', (_label, serverDecision, expected) => {
    expect(decidePaymentReportRequiredAccess(serverDecision)).toMatchObject(expected);
  });

  it('ignores client-only payment and token claims', () => {
    const clientControlledClaims = {
      serverDecision: { status: 'not-verified' } as const,
      paymentSucceeded: true,
      orderId: 'UW-client-controlled-order',
      reportAccessToken: 'client-controlled-token'
    };

    expect(decidePaymentReportRequiredAccess(clientControlledClaims.serverDecision)).toEqual({
      allowed: false,
      requirement: 'payment-or-report-access',
      denialCode: ACCESS_DENIAL_CODES.PAYMENT_REPORT_SERVER_VERIFICATION_REQUIRED
    });
  });
});

describe('server administrator session required', () => {
  const cases: ReadonlyArray<
    readonly [string, ServerAdminSessionDecision | null, Readonly<Record<string, unknown>>]
  > = [
    [
      'without a server session decision',
      null,
      { allowed: false, denialCode: ACCESS_DENIAL_CODES.ADMIN_SERVER_SESSION_REQUIRED }
    ],
    [
      'after a server denial',
      { status: 'denied' },
      { allowed: false, denialCode: ACCESS_DENIAL_CODES.ADMIN_SERVER_SESSION_DENIED }
    ],
    [
      'with a server-verified administrator session',
      { status: 'verified' },
      { allowed: true, grant: 'server-admin-session', authority: 'server' }
    ]
  ];

  it.each(cases)('%s', (_label, serverDecision, expected) => {
    expect(decideAdminRequiredAccess(serverDecision)).toMatchObject(expected);
  });

  it('does not treat a client-stored admin token as authority', () => {
    const clientControlledSession = {
      serverDecision: { status: 'not-verified' } as const,
      storedAdminToken: 'client-controlled-token',
      unlocked: true
    };

    expect(decideAdminRequiredAccess(clientControlledSession.serverDecision)).toEqual({
      allowed: false,
      requirement: 'admin-session',
      denialCode: ACCESS_DENIAL_CODES.ADMIN_SERVER_SESSION_REQUIRED
    });
  });
});
