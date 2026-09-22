import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  GuiyeondoRequestError,
  GuiyeondoService,
  type GuiyeondoRepository,
  type StoredGuiyeondoConnection,
  type StoredGuiyeondoInvite,
  type StoredGuiyeondoResponse
} from '../../../cloudrun-api/src/domains/guiyeondo/guiyeondoService.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const OWNER_USER_ID = 'kakao-owner-a';
const OTHER_USER_ID = 'kakao-owner-b';

function profile(name: string, birthDate = '1992-09-09', birthTime = '10:24') {
  return {
    name,
    gender: 'male',
    calendar: 'solar',
    isLeapMonth: false,
    birthDate,
    birthTime,
    isUnknownTime: false,
    birthTimePrecision: 'exact',
    dayBoundaryPolicy: 'midnight',
    location: '대한민국 · 표준시',
    birthLocation: {
      label: '대한민국 · 표준시',
      timezone: 'Asia/Seoul',
      utcOffsetMinutes: 540,
      applySolarTimeCorrection: false
    }
  } as const;
}

class MemoryGuiyeondoRepository implements GuiyeondoRepository {
  readonly invites = new Map<string, StoredGuiyeondoInvite>();
  readonly responses = new Map<string, StoredGuiyeondoResponse>();
  readonly connections = new Map<string, StoredGuiyeondoConnection>();
  readonly rateLimits = new Map<string, number>();
  private version = 0;

  async createInvite(input: Omit<StoredGuiyeondoInvite, 'updateTime'>) {
    if (this.invites.has(input.publicId)) return false;
    this.invites.set(input.publicId, { ...input, updateTime: `v${++this.version}` });
    return true;
  }

  async getInvite(publicId: string) {
    return this.invites.get(publicId) || null;
  }

  async listInvitesByOwner(ownerUserIdHash: string, limit: number) {
    return [...this.invites.values()].filter((item) => item.ownerUserIdHash === ownerUserIdHash).slice(0, limit);
  }

  async getResponse(responseId: string) {
    return this.responses.get(responseId) || null;
  }

  async createResponseWithSlot(invite: StoredGuiyeondoInvite, response: StoredGuiyeondoResponse) {
    const current = this.invites.get(invite.publicId);
    if (!current || current.updateTime !== invite.updateTime || this.responses.has(response.responseId)) return false;
    this.responses.set(response.responseId, response);
    this.invites.set(invite.publicId, {
      ...current,
      responseCount: current.responseCount + 1,
      updateTime: `v${++this.version}`
    });
    return true;
  }

  async listResponses(publicId: string, limit: number) {
    return [...this.responses.values()].filter((item) => item.publicId === publicId).slice(0, limit);
  }

  async revokeInvite(invite: StoredGuiyeondoInvite, revokedAt: string) {
    const current = this.invites.get(invite.publicId);
    if (!current || current.updateTime !== invite.updateTime) return false;
    this.invites.set(invite.publicId, {
      ...current,
      revokedAt,
      updateTime: `v${++this.version}`
    });
    return true;
  }

  async createConnection(input: Omit<StoredGuiyeondoConnection, 'updateTime'>) {
    if (this.connections.has(input.connectionId)) return false;
    this.connections.set(input.connectionId, { ...input, updateTime: `v${++this.version}` });
    return true;
  }

  async getConnection(connectionId: string) {
    return this.connections.get(connectionId) || null;
  }

  async listConnectionsByMember(memberHash: string, limit: number) {
    return [...this.connections.values()]
      .filter((item) => item.memberHashes.includes(memberHash))
      .slice(0, limit);
  }

  async updateConnectionMembership(
    connection: StoredGuiyeondoConnection,
    next: { memberHashes: string[]; removedBy: string[] }
  ) {
    const current = this.connections.get(connection.connectionId);
    if (!current || current.updateTime !== connection.updateTime) return false;
    this.connections.set(connection.connectionId, {
      ...current,
      memberHashes: next.memberHashes,
      removedBy: next.removedBy,
      updateTime: `v${++this.version}`
    });
    return true;
  }

  async deleteConnection(connection: StoredGuiyeondoConnection) {
    const current = this.connections.get(connection.connectionId);
    if (!current) return true;
    if (current.updateTime !== connection.updateTime) return false;
    this.connections.delete(connection.connectionId);
    return true;
  }

  async consumeRateLimit(input: { key: string; limit: number }) {
    const count = this.rateLimits.get(input.key) || 0;
    if (count >= input.limit) return false;
    this.rateLimits.set(input.key, count + 1);
    return true;
  }
}

function serviceFixture(overrides: Partial<ConstructorParameters<typeof GuiyeondoService>[0]['config']> = {}) {
  const repository = new MemoryGuiyeondoRepository();
  let clock = Date.parse('2026-09-15T00:00:00.000Z');
  const randomValues = [
    'a'.repeat(32),
    'b'.repeat(64),
    'c'.repeat(32),
    'd'.repeat(64)
  ];
  const service = new GuiyeondoService({
    repository,
    config: {
      enabled: true,
      inviteTtlMs: 14 * DAY_MS,
      rateLimitWindowMs: 60_000,
      createRateLimitMax: 100,
      readRateLimitMax: 100,
      responseRateLimitMax: 100,
      ownerRateLimitMax: 100,
      ...overrides
    },
    now: () => new Date(clock),
    randomHex: () => randomValues.shift() || 'e'.repeat(64)
  });
  return {
    service,
    repository,
    advance(milliseconds: number) { clock += milliseconds; }
  };
}

describe('GuiyeondoService privacy and capability contracts', () => {
  it('stores only a natal pillar snapshot and returns a 14-day public invite', async () => {
    const { service, repository } = serviceFixture();
    const result = await service.createInvite({ ownerProfile: profile('초대자') }, OWNER_USER_ID, '198.51.100.1');

    expect(result).not.toHaveProperty('ownerKey');
    expect(result.invite).toEqual({
      publicId: 'a'.repeat(32),
      hostName: '초대자',
      createdAt: '2026-09-15T00:00:00.000Z',
      expiresAt: '2026-09-29T00:00:00.000Z',
      sigilSeed: expect.stringMatching(/^gy-[a-f0-9]{16}$/)
    });

    const serialized = JSON.stringify([...repository.invites.values()]);
    expect(serialized).not.toContain('1992-09-09');
    expect(serialized).not.toContain('10:24');
    expect(serialized).not.toContain('Asia/Seoul');
    expect(serialized).not.toContain(OWNER_USER_ID);
    expect(serialized).toContain(createHash('sha256').update(`guiyeondo-owner:v1:${OWNER_USER_ID}`).digest('hex'));
    expect(await service.listInvites(OWNER_USER_ID, '198.51.100.2')).toEqual({ invites: [result.invite] });
    expect(await service.listInvites(OTHER_USER_ID, '198.51.100.2')).toEqual({ invites: [] });

    const publicResult = await service.getInvite(result.invite.publicId, '198.51.100.2');
    expect(publicResult).toEqual({ invite: result.invite });
    expect(JSON.stringify(publicResult)).not.toMatch(/natalSnapshot|ownerKey|birthDate|birthTime/);
  });

  it('does not persist guest birth input and protects owner response retrieval', async () => {
    const { service, repository } = serviceFixture();
    const created = await service.createInvite({ ownerProfile: profile('초대자') }, OWNER_USER_ID, '198.51.100.1');
    const response = await service.submitResponse(created.invite.publicId, {
      guestProfile: profile('응답자', '2000-01-01', '09:10'),
      idempotencyKey: 'guest-response-0001'
      ,consentVersion: 'guiyeondo-share-v1'
    }, '198.51.100.2');

    expect(response.person).toMatchObject({
      name: '응답자',
      source: 'invite',
      analysis: { compatibilityEngineVersion: '2.0.0' }
    });
    expect(response.person).not.toHaveProperty('privateBirthProfile');
    const serialized = JSON.stringify([...repository.responses.values()]);
    expect(serialized).not.toContain('2000-01-01');
    expect(serialized).not.toContain('09:10');
    expect(serialized).not.toContain('Asia/Seoul');
    expect(serialized).toContain('guiyeondo-share-v1');
    expect(serialized).toContain('2026-09-15T00:00:00.000Z');

    await expect(service.listResponses(created.invite.publicId, OTHER_USER_ID, '198.51.100.3'))
      .rejects.toMatchObject({ status: 403, code: 'OWNER_ACCOUNT_MISMATCH' });
    const ownerView = await service.listResponses(
      created.invite.publicId,
      OWNER_USER_ID,
      '198.51.100.3'
    );
    expect(ownerView.people).toEqual([response.person]);
  });

  it('is idempotent and rejects reuse of an idempotency key with different input', async () => {
    const { service, repository } = serviceFixture();
    const created = await service.createInvite({ ownerProfile: profile('초대자') }, OWNER_USER_ID, '198.51.100.1');
    const body = {
      guestProfile: profile('응답자', '2000-01-01', '09:10'),
      idempotencyKey: 'guest-response-0001'
      ,consentVersion: 'guiyeondo-share-v1'
    };
    const first = await service.submitResponse(created.invite.publicId, body, '198.51.100.2');
    const second = await service.submitResponse(created.invite.publicId, body, '198.51.100.2');

    expect(second).toEqual(first);
    expect(repository.responses.size).toBe(1);
    expect(repository.invites.get(created.invite.publicId)?.responseCount).toBe(1);

    const [concurrentA, concurrentB] = await Promise.all([
      service.submitResponse(created.invite.publicId, {
        guestProfile: profile('두 번째 응답자', '2001-01-01', '09:10'),
        idempotencyKey: 'guest-response-0002',
        consentVersion: 'guiyeondo-share-v1'
      }, '198.51.100.2'),
      service.submitResponse(created.invite.publicId, {
        guestProfile: profile('두 번째 응답자', '2001-01-01', '09:10'),
        idempotencyKey: 'guest-response-0002',
        consentVersion: 'guiyeondo-share-v1'
      }, '198.51.100.2')
    ]);
    expect(concurrentA).toEqual(concurrentB);
    expect(repository.responses.size).toBe(2);
    expect(repository.invites.get(created.invite.publicId)?.responseCount).toBe(2);

    await expect(service.submitResponse(created.invite.publicId, {
      ...body,
      guestProfile: profile('다른 응답자', '2001-01-01', '09:10')
    }, '198.51.100.2')).rejects.toMatchObject({ status: 409, code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('never exceeds the 100-response cap under concurrent different submissions', async () => {
    const { service, repository } = serviceFixture();
    const created = await service.createInvite({ ownerProfile: profile('초대자') }, OWNER_USER_ID, '198.51.100.1');
    const stored = repository.invites.get(created.invite.publicId);
    if (!stored) throw new Error('fixture invite missing');
    repository.invites.set(stored.publicId, { ...stored, responseCount: 99 });

    const settled = await Promise.allSettled([
      service.submitResponse(created.invite.publicId, {
        guestProfile: profile('응답자 A', '2000-01-01', '09:10'),
        idempotencyKey: 'guest-response-cap-a',
        consentVersion: 'guiyeondo-share-v1'
      }, '198.51.100.2'),
      service.submitResponse(created.invite.publicId, {
        guestProfile: profile('응답자 B', '2001-01-01', '09:10'),
        idempotencyKey: 'guest-response-cap-b',
        consentVersion: 'guiyeondo-share-v1'
      }, '198.51.100.2')
    ]);

    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejection = settled.find((result) => result.status === 'rejected');
    expect(rejection).toMatchObject({
      status: 'rejected',
      reason: { status: 409, code: 'RESPONSE_LIMIT_REACHED' }
    });
    expect(repository.responses.size).toBe(1);
    expect(repository.invites.get(created.invite.publicId)?.responseCount).toBe(100);
  });

  it('enforces immediate revocation, expiry, response cap, and distributed rate decisions', async () => {
    const first = serviceFixture({ readRateLimitMax: 1 });
    const created = await first.service.createInvite({ ownerProfile: profile('초대자') }, OWNER_USER_ID, '198.51.100.1');
    await first.service.getInvite(created.invite.publicId, '198.51.100.2');
    await expect(first.service.getInvite(created.invite.publicId, '198.51.100.2'))
      .rejects.toMatchObject({ status: 429, code: 'RATE_LIMITED' });

    await first.service.revokeInvite(created.invite.publicId, OWNER_USER_ID, '198.51.100.3');
    const repeated = await first.service.revokeInvite(created.invite.publicId, OWNER_USER_ID, '198.51.100.3');
    expect(repeated).toMatchObject({ ok: true, revokedAt: '2026-09-15T00:00:00.000Z' });
    await expect(first.service.revokeInvite(created.invite.publicId, OTHER_USER_ID, '198.51.100.3'))
      .rejects.toMatchObject({ status: 403, code: 'OWNER_ACCOUNT_MISMATCH' });
    await expect(first.service.getInvite(created.invite.publicId, '198.51.100.4'))
      .rejects.toMatchObject({ status: 410, code: 'INVITE_REVOKED' });

    const expired = serviceFixture();
    const expiringInvite = await expired.service.createInvite({ ownerProfile: profile('초대자') }, OWNER_USER_ID, '198.51.100.1');
    expired.advance(14 * DAY_MS + 1);
    await expect(expired.service.getInvite(expiringInvite.invite.publicId, '198.51.100.2'))
      .rejects.toMatchObject({ status: 410, code: 'INVITE_EXPIRED' });

    const capped = serviceFixture();
    const cappedInvite = await capped.service.createInvite({ ownerProfile: profile('초대자') }, OWNER_USER_ID, '198.51.100.1');
    const stored = capped.repository.invites.get(cappedInvite.invite.publicId);
    if (!stored) throw new Error('fixture invite missing');
    capped.repository.invites.set(stored.publicId, { ...stored, responseCount: 100 });
    await expect(capped.service.submitResponse(stored.publicId, {
      guestProfile: profile('응답자', '2000-01-01', '09:10'),
      idempotencyKey: 'guest-response-0001'
      ,consentVersion: 'guiyeondo-share-v1'
    }, '198.51.100.2')).rejects.toMatchObject({ status: 409, code: 'RESPONSE_LIMIT_REACHED' });
  });

  it('rejects malformed or policy-blocked birth input without persisting it', async () => {
    const { service, repository } = serviceFixture();
    await expect(service.createInvite({ ownerProfile: {
      ...profile('초대자'),
      birthLocation: { ...profile('초대자').birthLocation, timezone: 'Not/A_Timezone' }
    } }, OWNER_USER_ID, '198.51.100.1')).rejects.toBeInstanceOf(GuiyeondoRequestError);
    expect(repository.invites.size).toBe(0);
  });

  it('rejects under-14 birth data and missing guest sharing consent before saving', async () => {
    const { service, repository } = serviceFixture();
    await expect(service.createInvite({ ownerProfile: profile('미성년자', '2013-01-01') }, OWNER_USER_ID, '198.51.100.1'))
      .rejects.toMatchObject({ status: 422, code: 'AGE_RESTRICTED' });
    expect(repository.invites.size).toBe(0);

    const created = await service.createInvite({ ownerProfile: profile('초대자') }, OWNER_USER_ID, '198.51.100.1');
    await expect(service.submitResponse(created.invite.publicId, {
      guestProfile: profile('응답자', '2000-01-01', '09:10'),
      idempotencyKey: 'guest-response-0001'
    }, '198.51.100.2')).rejects.toMatchObject({ status: 422, code: 'CONSENT_REQUIRED' });
    await expect(service.submitResponse(created.invite.publicId, {
      guestProfile: profile('미성년자', '2013-01-01'),
      idempotencyKey: 'guest-response-0002',
      consentVersion: 'guiyeondo-share-v1'
    }, '198.51.100.2')).rejects.toMatchObject({ status: 422, code: 'AGE_RESTRICTED' });
    expect(repository.responses.size).toBe(0);
    expect(repository.invites.get(created.invite.publicId)?.responseCount).toBe(0);

    const malformedExpiry = repository.invites.get(created.invite.publicId);
    if (!malformedExpiry) throw new Error('fixture invite missing');
    repository.invites.set(malformedExpiry.publicId, { ...malformedExpiry, expiresAt: '' });
    await expect(service.getInvite(created.invite.publicId, '198.51.100.5'))
      .rejects.toMatchObject({ status: 503, code: 'INVITE_STATE_INVALID' });
  });
});
