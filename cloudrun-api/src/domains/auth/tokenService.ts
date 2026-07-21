import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { AppConfig } from '../../config/env.ts';
import type {
  AccessTokenPurpose,
  AuthenticatedUser,
  PaymentOrderClaims,
  ReportAccessClaims
} from '../../contracts/auth.ts';
import { PaymentRequestError, ReportRequestError } from '../../contracts/errors.ts';

const ACCESS_TOKEN_SECRET_ENV: Record<AccessTokenPurpose, string> = {
  order: 'REPORT_ACCESS_SECRET',
  report: 'REPORT_ACCESS_SECRET',
  user: 'USER_ACCESS_SECRET',
  admin: 'ADMIN_ACCESS_SECRET'
};

const ACCESS_TOKEN_CLOCK_SKEW_MS = 60 * 1000;

export type SignedAccessTokenPayload = Record<string, unknown> & {
  purpose: AccessTokenPurpose;
  sub: string;
  iat: number;
  exp: number;
  nonce: string;
};

export type ReportAccessTokenInput = {
  userId: string;
  orderId: string;
  paymentId: string;
  productId: string;
  amount: number;
  entitlementId: string;
};

export type PaymentOrderClaimInput = {
  userId: string;
  orderId: string;
  productId: string;
  amount: number;
};

export type UserAccessTokenInput = {
  id: string;
  nickname?: string;
  email?: string;
};

function toBase64Url(value: string | Buffer) {
  return Buffer.from(value).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string) {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error('Invalid base64url value.');
  }

  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf-8');
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim());
}

function isFiniteInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isSafeInteger(value);
}

export class TokenService {
  private readonly developmentAccessTokenSecrets: Record<AccessTokenPurpose, string> = {
    order: randomBytes(32).toString('base64url'),
    report: randomBytes(32).toString('base64url'),
    user: randomBytes(32).toString('base64url'),
    admin: randomBytes(32).toString('base64url')
  };

  constructor(private readonly config: AppConfig) {}

  ensureSecret(purpose: AccessTokenPurpose) {
    const envName = ACCESS_TOKEN_SECRET_ENV[purpose];
    const secret =
      purpose === 'order' || purpose === 'report'
        ? this.config.auth.reportAccessSecret.trim()
        : purpose === 'user'
          ? this.config.auth.userAccessSecret.trim()
          : this.config.auth.adminAccessSecret.trim();

    if (secret) {
      return secret;
    }

    if (!this.config.production) {
      return this.developmentAccessTokenSecrets[purpose];
    }

    throw new ReportRequestError(503, `${envName} is not configured.`);
  }

  private signAccessTokenPayload(encodedPayload: string, purpose: AccessTokenPurpose, secret: string) {
    if (!secret.trim()) {
      throw new ReportRequestError(503, 'Access token signing secret is empty.');
    }

    return createHmac('sha256', secret)
      .update(`unwoldang-access-token:v2:${purpose}:${encodedPayload}`)
      .digest('base64url');
  }

  createSignedAccessToken(
    purpose: AccessTokenPurpose,
    subject: string,
    claims: Record<string, unknown>,
    ttlMs: number
  ) {
    if (!isNonEmptyString(subject)) {
      throw new ReportRequestError(500, 'Access token subject is required.');
    }

    if (!isFiniteInteger(ttlMs) || ttlMs <= 0) {
      throw new ReportRequestError(500, 'Access token TTL is invalid.');
    }

    const reservedClaims = ['purpose', 'sub', 'iat', 'exp', 'nonce'];

    if (reservedClaims.some((claim) => Object.prototype.hasOwnProperty.call(claims, claim))) {
      throw new ReportRequestError(500, 'Reserved access token claim cannot be overridden.');
    }

    const secret = this.ensureSecret(purpose);
    const now = Date.now();
    const expiresAt = now + ttlMs;

    if (!isFiniteInteger(now) || !isFiniteInteger(expiresAt)) {
      throw new ReportRequestError(500, 'Access token timestamps are invalid.');
    }

    const encodedPayload = toBase64Url(
      JSON.stringify({
        ...claims,
        purpose,
        sub: subject.trim(),
        iat: now,
        exp: expiresAt,
        nonce: randomBytes(12).toString('hex')
      })
    );
    const signature = this.signAccessTokenPayload(encodedPayload, purpose, secret);

    return `${encodedPayload}.${signature}`;
  }

  verifySignedAccessToken(token: string, expectedPurpose: AccessTokenPurpose): SignedAccessTokenPayload {
    const segments = token.split('.');

    if (segments.length !== 2 || !segments[0] || !segments[1]) {
      throw new ReportRequestError(401, 'Invalid access token.');
    }

    const [encodedPayload, signature] = segments;

    if (!/^[A-Za-z0-9_-]+$/.test(signature)) {
      throw new ReportRequestError(401, 'Invalid access token.');
    }

    const secret = this.ensureSecret(expectedPurpose);
    const expectedSignature = this.signAccessTokenPayload(encodedPayload, expectedPurpose, secret);

    if (!safeEqual(signature, expectedSignature)) {
      throw new ReportRequestError(401, 'Invalid access token.');
    }

    let payload: unknown;

    try {
      payload = JSON.parse(fromBase64Url(encodedPayload));
    } catch {
      throw new ReportRequestError(401, 'Invalid access token.');
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new ReportRequestError(401, 'Invalid access token.');
    }

    const claims = payload as Record<string, unknown>;

    if (claims.purpose !== expectedPurpose) {
      throw new ReportRequestError(403, 'Access token purpose does not match this request.');
    }

    if (
      !isNonEmptyString(claims.sub) ||
      !isNonEmptyString(claims.nonce) ||
      !isFiniteInteger(claims.iat) ||
      !isFiniteInteger(claims.exp) ||
      claims.iat <= 0 ||
      claims.exp <= claims.iat
    ) {
      throw new ReportRequestError(401, 'Invalid access token claims.');
    }

    const now = Date.now();

    if (claims.iat > now + ACCESS_TOKEN_CLOCK_SKEW_MS) {
      throw new ReportRequestError(401, 'Access token was issued in the future.');
    }

    if (claims.exp <= now) {
      throw new ReportRequestError(401, 'Access token has expired.');
    }

    return claims as SignedAccessTokenPayload;
  }

  createUserBinding(userId: string) {
    if (!isNonEmptyString(userId)) {
      throw new ReportRequestError(500, 'Authenticated user identity is required.');
    }

    return createHmac('sha256', this.ensureSecret('report'))
      .update(`unwoldang-user-binding:v1:${userId.trim()}`)
      .digest('base64url');
  }

  createReportAccessToken(input: ReportAccessTokenInput) {
    const userBinding = this.createUserBinding(input.userId);

    return this.createSignedAccessToken(
      'report',
      userBinding,
      {
        orderId: input.orderId,
        paymentId: input.paymentId,
        productId: input.productId,
        amount: input.amount,
        userBinding,
        entitlementId: input.entitlementId
      },
      this.config.report.accessTokenTtlMs
    );
  }

  verifyReportAccessToken(token: string): ReportAccessClaims {
    const payload = this.verifySignedAccessToken(token, 'report');

    if (
      !isNonEmptyString(payload.orderId) ||
      !isNonEmptyString(payload.paymentId) ||
      !isNonEmptyString(payload.productId) ||
      !isNonEmptyString(payload.userBinding) ||
      !isNonEmptyString(payload.entitlementId) ||
      !isFiniteInteger(payload.amount) ||
      payload.amount <= 0 ||
      payload.sub !== payload.userBinding
    ) {
      throw new ReportRequestError(401, 'Invalid report access token claims.');
    }

    return payload as SignedAccessTokenPayload & ReportAccessClaims;
  }

  createPaymentOrderClaim(input: PaymentOrderClaimInput) {
    const userBinding = this.createUserBinding(input.userId);

    return this.createSignedAccessToken(
      'order',
      userBinding,
      {
        orderId: input.orderId,
        productId: input.productId,
        amount: input.amount,
        userBinding,
        version: 1
      },
      this.config.report.orderClaimTtlMs
    );
  }

  verifyPaymentOrderClaim(token: string, userId: string): PaymentOrderClaims {
    const payload = this.verifySignedAccessToken(token, 'order');
    const expectedUserBinding = this.createUserBinding(userId);

    if (
      !isNonEmptyString(payload.orderId) ||
      !isNonEmptyString(payload.productId) ||
      !isNonEmptyString(payload.userBinding) ||
      !isNonEmptyString(payload.nonce) ||
      !isFiniteInteger(payload.amount) ||
      payload.amount <= 0 ||
      payload.version !== 1 ||
      payload.sub !== expectedUserBinding ||
      payload.userBinding !== expectedUserBinding
    ) {
      throw new PaymentRequestError(403, '결제 주문 인증 정보가 로그인 사용자와 일치하지 않습니다.');
    }

    return payload as SignedAccessTokenPayload & PaymentOrderClaims;
  }

  createOrderAccessToken(input: PaymentOrderClaimInput) {
    return this.createPaymentOrderClaim(input);
  }

  verifyOrderAccessToken(token: string, userId: string) {
    return this.verifyPaymentOrderClaim(token, userId);
  }

  createUserAccessToken(user: UserAccessTokenInput) {
    return this.createSignedAccessToken(
      'user',
      user.id,
      {
        nickname: user.nickname,
        email: user.email,
        provider: 'kakao'
      },
      this.config.auth.accessTokenTtlMs
    );
  }

  createAuthAccessToken(user: UserAccessTokenInput) {
    return this.createUserAccessToken(user);
  }

  verifyUserAccessToken(token: string): AuthenticatedUser {
    const payload = this.verifySignedAccessToken(token, 'user');

    if (payload.provider !== 'kakao') {
      throw new ReportRequestError(401, 'Invalid login access token.');
    }

    return {
      userId: String(payload.sub),
      nickname: payload.nickname as string | undefined,
      email: payload.email as string | undefined
    };
  }

  createAdminAccessToken(adminId: string) {
    return this.createSignedAccessToken('admin', adminId, {}, this.config.auth.adminAccessTokenTtlMs);
  }

  verifyAdminAccessToken(token: string) {
    const payload = this.verifySignedAccessToken(token, 'admin');

    if (!payload.sub) {
      throw new ReportRequestError(401, 'Invalid admin access token.');
    }

    return payload;
  }
}

export function createTokenService(config: AppConfig) {
  return new TokenService(config);
}
