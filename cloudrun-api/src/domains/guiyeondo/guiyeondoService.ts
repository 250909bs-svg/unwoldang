import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  analyzeGuiyeondoSnapshots,
  createGuiyeondoNatalSnapshot,
  GuiyeondoProfileValidationError,
  parseGuiyeondoBirthProfile,
  type GuiyeondoNatalSnapshot,
  type GuiyeondoServerAnalysis
} from '../../../../src/lib/guiyeondo/serverAnalysis.ts';

const PUBLIC_ID_PATTERN = /^[a-f0-9]{32}$/;
const OWNER_KEY_PATTERN = /^[a-f0-9]{64}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;
const MAX_RESPONSES = 100;
const GUEST_CONSENT_VERSION = 'guiyeondo-share-v1';

export interface StoredGuiyeondoInvite {
  publicId: string;
  hostName: string;
  natalSnapshot: GuiyeondoNatalSnapshot;
  sigilSeed: string;
  ownerKeyHash: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string;
  responseCount: number;
  updateTime: string;
}

export interface StoredGuiyeondoResponse {
  responseId: string;
  publicId: string;
  expiresAt: string;
  requestFingerprint: string;
  consentVersion: typeof GUEST_CONSENT_VERSION;
  consentedAt: string;
  person: GuiyeondoPersonResponse;
}

export interface GuiyeondoPersonResponse {
  id: string;
  name: string;
  source: 'invite';
  createdAt: string;
  expiresAt: string;
  analysis: GuiyeondoServerAnalysis;
}

export interface GuiyeondoRepository {
  createInvite(invite: Omit<StoredGuiyeondoInvite, 'updateTime'>): Promise<boolean>;
  getInvite(publicId: string): Promise<StoredGuiyeondoInvite | null>;
  getResponse(responseId: string): Promise<StoredGuiyeondoResponse | null>;
  createResponseWithSlot(invite: StoredGuiyeondoInvite, response: StoredGuiyeondoResponse): Promise<boolean>;
  listResponses(publicId: string, limit: number): Promise<StoredGuiyeondoResponse[]>;
  revokeInvite(invite: StoredGuiyeondoInvite, revokedAt: string): Promise<boolean>;
  consumeRateLimit(input: {
    key: string;
    windowStartedAt: string;
    expiresAt: string;
    limit: number;
  }): Promise<boolean>;
}

export class GuiyeondoRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = 'GuiyeondoRequestError';
  }
}

export type GuiyeondoServiceConfig = {
  enabled: boolean;
  inviteTtlMs: number;
  rateLimitWindowMs: number;
  createRateLimitMax: number;
  readRateLimitMax: number;
  responseRateLimitMax: number;
  ownerRateLimitMax: number;
};

export interface GuiyeondoApi {
  createInvite(body: unknown, clientIp: string): Promise<unknown>;
  getInvite(publicId: string, clientIp: string): Promise<unknown>;
  submitResponse(publicId: string, body: unknown, clientIp: string): Promise<unknown>;
  listResponses(publicId: string, ownerKey: string, clientIp: string): Promise<unknown>;
  revokeInvite(publicId: string, ownerKey: string, clientIp: string): Promise<unknown>;
}

type GuiyeondoServiceOptions = {
  repository: GuiyeondoRepository;
  config: GuiyeondoServiceConfig;
  now?: () => Date;
  randomHex?: (byteLength: number) => string;
};

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizePublicId(value: string) {
  const publicId = value.trim().toLowerCase();
  if (!PUBLIC_ID_PATTERN.test(publicId)) {
    throw new GuiyeondoRequestError(404, '초대장을 찾을 수 없습니다.', 'INVITE_NOT_FOUND');
  }
  return publicId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function publicInvite(invite: StoredGuiyeondoInvite) {
  return {
    publicId: invite.publicId,
    hostName: invite.hostName,
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt,
    sigilSeed: invite.sigilSeed
  };
}

export class GuiyeondoService implements GuiyeondoApi {
  private readonly now: () => Date;
  private readonly randomHex: (byteLength: number) => string;

  constructor(private readonly options: GuiyeondoServiceOptions) {
    this.now = options.now || (() => new Date());
    this.randomHex = options.randomHex || ((byteLength) => randomBytes(byteLength).toString('hex'));
  }

  private async enforceRateLimit(scope: string, clientIp: string, limit: number) {
    if (!this.options.config.enabled) {
      throw new GuiyeondoRequestError(503, '귀연도 공유 저장소가 준비되지 않았습니다.', 'SERVICE_UNAVAILABLE');
    }
    const now = this.now();
    const windowMs = this.options.config.rateLimitWindowMs;
    const windowStart = Math.floor(now.getTime() / windowMs) * windowMs;
    const allowed = await this.options.repository.consumeRateLimit({
      key: hash(`guiyeondo:${scope}:${clientIp || 'unknown'}:${windowStart}`),
      windowStartedAt: new Date(windowStart).toISOString(),
      expiresAt: new Date(windowStart + windowMs * 2).toISOString(),
      limit
    });
    if (!allowed) {
      throw new GuiyeondoRequestError(429, '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.', 'RATE_LIMITED');
    }
  }

  private assertActive(invite: StoredGuiyeondoInvite) {
    if (invite.revokedAt) {
      throw new GuiyeondoRequestError(410, '철회된 초대장입니다. 새 링크를 요청해 주세요.', 'INVITE_REVOKED');
    }
    const expiresAt = Date.parse(invite.expiresAt);
    if (!Number.isFinite(expiresAt)) {
      throw new GuiyeondoRequestError(503, '초대장 상태를 확인하지 못했습니다.', 'INVITE_STATE_INVALID');
    }
    if (expiresAt <= this.now().getTime()) {
      throw new GuiyeondoRequestError(410, '만료된 초대장입니다. 새 링크를 요청해 주세요.', 'INVITE_EXPIRED');
    }
  }

  private async requireInvite(publicIdValue: string) {
    const publicId = normalizePublicId(publicIdValue);
    const invite = await this.options.repository.getInvite(publicId);
    if (!invite) {
      throw new GuiyeondoRequestError(404, '초대장을 찾을 수 없습니다.', 'INVITE_NOT_FOUND');
    }
    this.assertActive(invite);
    return invite;
  }

  private assertOwner(invite: StoredGuiyeondoInvite, ownerKeyValue: string) {
    const ownerKey = ownerKeyValue.trim().toLowerCase();
    if (!OWNER_KEY_PATTERN.test(ownerKey)) {
      throw new GuiyeondoRequestError(401, '초대 관리 권한이 필요합니다.', 'OWNER_KEY_REQUIRED');
    }
    const actual = Buffer.from(hash(ownerKey), 'hex');
    const expected = Buffer.from(invite.ownerKeyHash, 'hex');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new GuiyeondoRequestError(403, '초대 관리 권한이 올바르지 않습니다.', 'OWNER_KEY_INVALID');
    }
  }

  private parseSnapshot(value: unknown) {
    try {
      const parsed = parseGuiyeondoBirthProfile(value);
      const solarDate = parsed.calculation.primary?.bazi.solar
        || parsed.calculation.scenarios[0]?.bazi.solar;
      if (!solarDate || solarDate.length !== 3) {
        throw new GuiyeondoRequestError(422, '출생일을 확인할 수 없습니다.', 'INVALID_BIRTH_PROFILE');
      }
      const birthDate = new Date(Date.UTC(solarDate[0], solarDate[1] - 1, solarDate[2]));
      const minimumAgeDate = new Date(this.now().getTime());
      minimumAgeDate.setUTCFullYear(minimumAgeDate.getUTCFullYear() - 14);
      if (birthDate > minimumAgeDate) {
        throw new GuiyeondoRequestError(422, '만 14세 이상만 귀연도를 이용할 수 있습니다.', 'AGE_RESTRICTED');
      }
      return {
        profile: parsed.profile,
        snapshot: createGuiyeondoNatalSnapshot(parsed.calculation)
      };
    } catch (error) {
      if (error instanceof GuiyeondoProfileValidationError) {
        throw new GuiyeondoRequestError(422, error.message, 'INVALID_BIRTH_PROFILE');
      }
      throw error;
    }
  }

  async createInvite(body: unknown, clientIp: string) {
    await this.enforceRateLimit('create', clientIp, this.options.config.createRateLimitMax);
    if (!isRecord(body)) {
      throw new GuiyeondoRequestError(400, '요청 형식이 올바르지 않습니다.', 'INVALID_REQUEST');
    }

    const parsed = this.parseSnapshot(body.ownerProfile);
    const createdAt = this.now().toISOString();
    const expiresAt = new Date(this.now().getTime() + this.options.config.inviteTtlMs).toISOString();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const publicId = this.randomHex(16).toLowerCase();
      const ownerKey = this.randomHex(32).toLowerCase();
      if (!PUBLIC_ID_PATTERN.test(publicId) || !OWNER_KEY_PATTERN.test(ownerKey)) continue;
      const invite: Omit<StoredGuiyeondoInvite, 'updateTime'> = {
        publicId,
        hostName: parsed.profile.name,
        natalSnapshot: parsed.snapshot,
        sigilSeed: `gy-${hash(`sigil:${publicId}`).slice(0, 16)}`,
        ownerKeyHash: hash(ownerKey),
        createdAt,
        expiresAt,
        revokedAt: '',
        responseCount: 0
      };
      if (await this.options.repository.createInvite(invite)) {
        return { invite: publicInvite({ ...invite, updateTime: '' }), ownerKey };
      }
    }
    throw new GuiyeondoRequestError(503, '초대 링크를 만들지 못했습니다. 다시 시도해 주세요.', 'INVITE_CREATE_FAILED');
  }

  async getInvite(publicId: string, clientIp: string) {
    await this.enforceRateLimit('read', clientIp, this.options.config.readRateLimitMax);
    return { invite: publicInvite(await this.requireInvite(publicId)) };
  }

  async submitResponse(publicIdValue: string, body: unknown, clientIp: string) {
    const publicId = normalizePublicId(publicIdValue);
    await this.enforceRateLimit('response', clientIp, this.options.config.responseRateLimitMax);
    if (!isRecord(body) || typeof body.idempotencyKey !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(body.idempotencyKey)) {
      throw new GuiyeondoRequestError(400, '응답 요청 식별값이 올바르지 않습니다.', 'INVALID_IDEMPOTENCY_KEY');
    }
    const invite = await this.requireInvite(publicId);
    if (body.consentVersion !== GUEST_CONSENT_VERSION) {
      throw new GuiyeondoRequestError(422, '인연 결과 공유에 동의해 주세요.', 'CONSENT_REQUIRED');
    }
    const parsed = this.parseSnapshot(body.guestProfile);

    const requestFingerprint = hash(JSON.stringify({
      name: parsed.profile.name,
      snapshot: parsed.snapshot
    }));
    const responseId = hash(`${publicId}:${body.idempotencyKey}`);
    const existing = await this.options.repository.getResponse(responseId);
    if (existing) {
      if (existing.requestFingerprint !== requestFingerprint || existing.publicId !== publicId) {
        throw new GuiyeondoRequestError(409, '같은 요청 식별값으로 다른 응답을 저장할 수 없습니다.', 'IDEMPOTENCY_CONFLICT');
      }
      return { person: existing.person };
    }

    const createdAt = this.now().toISOString();
    const person: GuiyeondoPersonResponse = {
      id: responseId,
      name: parsed.profile.name,
      source: 'invite',
      createdAt,
      expiresAt: invite.expiresAt,
      analysis: analyzeGuiyeondoSnapshots(invite.natalSnapshot, parsed.snapshot)
    };
    const response: StoredGuiyeondoResponse = {
      responseId,
      publicId,
      expiresAt: invite.expiresAt,
      requestFingerprint,
      consentVersion: GUEST_CONSENT_VERSION,
      consentedAt: createdAt,
      person
    };
    let latest = invite;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const concurrent = await this.options.repository.getResponse(responseId);
      if (concurrent) {
        if (concurrent.requestFingerprint !== requestFingerprint || concurrent.publicId !== publicId) {
          throw new GuiyeondoRequestError(409, '같은 요청 식별값으로 다른 응답을 저장할 수 없습니다.', 'IDEMPOTENCY_CONFLICT');
        }
        return { person: concurrent.person };
      }
      this.assertActive(latest);
      if (latest.responseCount >= MAX_RESPONSES) {
        throw new GuiyeondoRequestError(409, '이 초대에는 최대 100명까지 응답할 수 있습니다.', 'RESPONSE_LIMIT_REACHED');
      }
      if (await this.options.repository.createResponseWithSlot(latest, response)) return { person };
      const refreshed = await this.options.repository.getInvite(publicId);
      if (!refreshed) break;
      latest = refreshed;
    }
    throw new GuiyeondoRequestError(409, '응답이 동시에 처리되고 있습니다. 다시 시도해 주세요.', 'RESPONSE_CREATE_CONFLICT');
  }

  async listResponses(publicIdValue: string, ownerKey: string, clientIp: string) {
    const publicId = normalizePublicId(publicIdValue);
    await this.enforceRateLimit('owner', clientIp, this.options.config.ownerRateLimitMax);
    const invite = await this.requireInvite(publicId);
    this.assertOwner(invite, ownerKey);
    const responses = await this.options.repository.listResponses(publicId, MAX_RESPONSES);
    return { people: responses.map((response) => response.person) };
  }

  async revokeInvite(publicIdValue: string, ownerKey: string, clientIp: string) {
    const publicId = normalizePublicId(publicIdValue);
    await this.enforceRateLimit('owner', clientIp, this.options.config.ownerRateLimitMax);
    let invite = await this.options.repository.getInvite(publicId);
    if (!invite) {
      throw new GuiyeondoRequestError(404, '초대장을 찾을 수 없습니다.', 'INVITE_NOT_FOUND');
    }
    this.assertOwner(invite, ownerKey);
    if (invite.revokedAt) return { ok: true, publicId, revokedAt: invite.revokedAt };
    const revokedAt = this.now().toISOString();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (await this.options.repository.revokeInvite(invite, revokedAt)) {
        return { ok: true, publicId, revokedAt };
      }
      const refreshed = await this.options.repository.getInvite(publicId);
      if (!refreshed) break;
      if (refreshed.revokedAt) return { ok: true, publicId, revokedAt: refreshed.revokedAt };
      this.assertOwner(refreshed, ownerKey);
      invite = refreshed;
    }
    throw new GuiyeondoRequestError(409, '초대 철회가 동시에 처리되고 있습니다. 다시 시도해 주세요.', 'REVOKE_CONFLICT');
  }
}
