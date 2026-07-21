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
      throw new ReportRequestError(503, 'ADMIN_CREDENTIAL_HASH is not configured.');
    }

    this.tokens.ensureSecret('admin');

    const adminId = getRequiredString(body, 'adminId');
    const password = getRequiredString(body, 'password');
    const inputHash = createHash('sha256').update(`${adminId}:${password}`).digest('hex');

    if (!safeEqual(inputHash, configuredHash)) {
      throw new ReportRequestError(401, 'Admin id or password is incorrect.');
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
