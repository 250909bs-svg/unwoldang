export const ACCESS_DENIAL_CODES = Object.freeze({
  LOGIN_REQUIRED: 'AUTH_LOGIN_REQUIRED',
  PAYMENT_REPORT_SERVER_VERIFICATION_REQUIRED: 'PAYMENT_REPORT_SERVER_VERIFICATION_REQUIRED',
  PAYMENT_REPORT_ACCESS_DENIED: 'PAYMENT_REPORT_ACCESS_DENIED',
  ADMIN_SERVER_SESSION_REQUIRED: 'ADMIN_SERVER_SESSION_REQUIRED',
  ADMIN_SERVER_SESSION_DENIED: 'ADMIN_SERVER_SESSION_DENIED'
} as const);

export type AccessDenialCode = (typeof ACCESS_DENIAL_CODES)[keyof typeof ACCESS_DENIAL_CODES];
export type AccessRequirement = 'login' | 'payment-or-report-access' | 'admin-session';
export type AccessAuthority = 'client-navigation-state' | 'server';

export type AccessDecision<
  Requirement extends AccessRequirement,
  Grant extends string,
  Denial extends AccessDenialCode
> =
  | Readonly<{
      allowed: true;
      requirement: Requirement;
      grant: Grant;
      authority: AccessAuthority;
    }>
  | Readonly<{
      allowed: false;
      requirement: Requirement;
      denialCode: Denial;
    }>;

export type LoginRequiredDecision = AccessDecision<
  'login',
  'authenticated-navigation',
  typeof ACCESS_DENIAL_CODES.LOGIN_REQUIRED
>;

/**
 * This is a navigation-only login gate. An allow result never authorizes a
 * protected API operation; the server must still authenticate that request.
 */
export function decideLoginRequiredAccess(isAuthenticated: boolean): LoginRequiredDecision {
  if (isAuthenticated) {
    return {
      allowed: true,
      requirement: 'login',
      grant: 'authenticated-navigation',
      authority: 'client-navigation-state'
    };
  }

  return {
    allowed: false,
    requirement: 'login',
    denialCode: ACCESS_DENIAL_CODES.LOGIN_REQUIRED
  };
}

export type ServerPaymentReportAccessMode = 'payment-entitlement' | 'archive-replay';

/**
 * `verified` must describe a decision returned by the server. An order id,
 * payment-success flag, bearer token, or report payload held by the client is
 * not a substitute for this decision.
 */
export type ServerPaymentReportAccessDecision =
  | Readonly<{
      status: 'verified';
      mode: ServerPaymentReportAccessMode;
    }>
  | Readonly<{
      status: 'not-verified';
    }>
  | Readonly<{
      status: 'denied';
    }>;

export type PaymentReportRequiredDecision = AccessDecision<
  'payment-or-report-access',
  ServerPaymentReportAccessMode,
  | typeof ACCESS_DENIAL_CODES.PAYMENT_REPORT_SERVER_VERIFICATION_REQUIRED
  | typeof ACCESS_DENIAL_CODES.PAYMENT_REPORT_ACCESS_DENIED
>;

export function decidePaymentReportRequiredAccess(
  serverDecision?: ServerPaymentReportAccessDecision | null
): PaymentReportRequiredDecision {
  if (
    serverDecision?.status === 'verified' &&
    (serverDecision.mode === 'payment-entitlement' || serverDecision.mode === 'archive-replay')
  ) {
    return {
      allowed: true,
      requirement: 'payment-or-report-access',
      grant: serverDecision.mode,
      authority: 'server'
    };
  }

  if (serverDecision?.status === 'denied') {
    return {
      allowed: false,
      requirement: 'payment-or-report-access',
      denialCode: ACCESS_DENIAL_CODES.PAYMENT_REPORT_ACCESS_DENIED
    };
  }

  return {
    allowed: false,
    requirement: 'payment-or-report-access',
    denialCode: ACCESS_DENIAL_CODES.PAYMENT_REPORT_SERVER_VERIFICATION_REQUIRED
  };
}

/**
 * Only a server-verified administrator session can grant access. A token or
 * unlock flag found in client storage is not administrator authority.
 */
export type ServerAdminSessionDecision =
  | Readonly<{
      status: 'verified';
    }>
  | Readonly<{
      status: 'not-verified';
    }>
  | Readonly<{
      status: 'denied';
    }>;

export type AdminRequiredDecision = AccessDecision<
  'admin-session',
  'server-admin-session',
  | typeof ACCESS_DENIAL_CODES.ADMIN_SERVER_SESSION_REQUIRED
  | typeof ACCESS_DENIAL_CODES.ADMIN_SERVER_SESSION_DENIED
>;

export function decideAdminRequiredAccess(
  serverDecision?: ServerAdminSessionDecision | null
): AdminRequiredDecision {
  if (serverDecision?.status === 'verified') {
    return {
      allowed: true,
      requirement: 'admin-session',
      grant: 'server-admin-session',
      authority: 'server'
    };
  }

  if (serverDecision?.status === 'denied') {
    return {
      allowed: false,
      requirement: 'admin-session',
      denialCode: ACCESS_DENIAL_CODES.ADMIN_SERVER_SESSION_DENIED
    };
  }

  return {
    allowed: false,
    requirement: 'admin-session',
    denialCode: ACCESS_DENIAL_CODES.ADMIN_SERVER_SESSION_REQUIRED
  };
}
