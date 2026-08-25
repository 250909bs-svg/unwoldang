import { createHash, timingSafeEqual } from 'node:crypto';
import type { AppConfig } from '../../config/env.ts';
import { ReportRequestError } from '../../contracts/errors.ts';
import { getRequiredString } from '../../http/validation.ts';

type AdminTokenService = {
  ensureSecret(purpose: 'admin'): string;
  createSignedAccessToken(
    purpose: 'admin',
    subject: string,
    claims: Record<string, unknown>,
    ttlMs: number
  ): string;
};

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export class AdminService {
  constructor(
    private readonly config: AppConfig,
    private readonly tokens: AdminTokenService
  ) {}

  login(body: Record<string, unknown>) {
    const configuredHash = this.config.auth.adminCredentialHash;

    if (!configuredHash) {
      throw new ReportRequestError(503, '관리자 로그인을 사용할 수 없습니다.');
    }

    this.tokens.ensureSecret('admin');

    const adminId = getRequiredString(body, 'adminId');
    const password = getRequiredString(body, 'password');
    const inputHash = createHash('sha256').update(`${adminId}:${password}`).digest('hex');

    if (!safeEqual(inputHash, configuredHash)) {
      throw new ReportRequestError(401, '아이디 또는 비밀번호가 올바르지 않습니다.');
    }

    return {
      adminAccessToken: this.tokens.createSignedAccessToken(
        'admin',
        adminId,
        {},
        this.config.auth.adminAccessTokenTtlMs
      ),
      expiresInMs: this.config.auth.adminAccessTokenTtlMs
    };
  }
}
