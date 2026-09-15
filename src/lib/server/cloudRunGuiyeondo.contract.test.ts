import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../cloudrun-api/src/app.ts';
import { loadConfig } from '../../../cloudrun-api/src/config/env.ts';
import { TokenService } from '../../../cloudrun-api/src/domains/auth/tokenService.ts';
import {
  GuiyeondoRequestError,
  type GuiyeondoApi
} from '../../../cloudrun-api/src/domains/guiyeondo/guiyeondoService.ts';

const publicId = 'a'.repeat(32);
const ownerUserId = 'kakao-owner-a';
const otherUserId = 'kakao-owner-b';
const invite = {
  publicId,
  hostName: '초대자',
  createdAt: '2026-09-15T00:00:00.000Z',
  expiresAt: '2026-09-29T00:00:00.000Z',
  sigilSeed: 'gy-0123abcd'
};
const person = {
  id: 'c'.repeat(64),
  name: '응답자',
  source: 'invite',
  createdAt: '2026-09-15T00:01:00.000Z',
  analysis: { compatibilityEngineVersion: '2.0.0' }
};

const guiyeondo: GuiyeondoApi = {
  createInvite: vi.fn(async (_body, userId) => {
    if (userId !== ownerUserId) throw new GuiyeondoRequestError(403, '권한이 없습니다.', 'OWNER_ACCOUNT_MISMATCH');
    return { invite };
  }),
  listInvites: vi.fn(async (userId) => ({ invites: userId === ownerUserId ? [invite] : [] })),
  getInvite: vi.fn(async () => ({ invite })),
  submitResponse: vi.fn(async () => ({ person })),
  listResponses: vi.fn(async (_publicId, userId) => {
    if (userId !== ownerUserId) {
      throw new GuiyeondoRequestError(403, '이 초대장을 관리할 권한이 없습니다.', 'OWNER_ACCOUNT_MISMATCH');
    }
    return { people: [person] };
  }),
  revokeInvite: vi.fn(async (_publicId, userId) => {
    if (userId !== ownerUserId) {
      throw new GuiyeondoRequestError(403, '이 초대장을 관리할 권한이 없습니다.', 'OWNER_ACCOUNT_MISMATCH');
    }
    return { ok: true, publicId, revokedAt: '2026-09-15T00:02:00.000Z' };
  })
};

const config = loadConfig({
  NODE_ENV: 'development',
  ALLOW_UNVERIFIED_REPORTS: 'true',
  USER_ACCESS_SECRET: 'guiyeondo-contract-user-access-secret'
});
const tokens = new TokenService(config);
const ownerToken = tokens.createUserAccessToken({ id: ownerUserId, nickname: '초대자' });
const otherToken = tokens.createUserAccessToken({ id: otherUserId, nickname: '다른 사용자' });

let server: Server;
let baseUrl = '';

beforeAll(async () => {
  server = createServer(createApp({
    config,
    guiyeondoService: guiyeondo,
    fetchImplementation: vi.fn(async () => { throw new Error('unexpected external request'); }) as unknown as typeof fetch
  }));
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

describe('Cloud Run Guiyeondo HTTP account ownership contract', () => {
  it('requires Kakao user auth to create and does not expose private source data', async () => {
    const denied = await fetch(`${baseUrl}/api/guiyeondo/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerProfile: { name: '초대자', birthDate: '1992-09-09' } })
    });
    expect(denied.status).toBe(401);
    expect(await denied.json()).toMatchObject({ code: 'OWNER_LOGIN_REQUIRED' });

    const response = await fetch(`${baseUrl}/api/guiyeondo/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ ownerProfile: { name: '초대자', birthDate: '1992-09-09' } })
    });
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body).toEqual({ invite });
    expect(JSON.stringify(body)).not.toMatch(/birth|natal|ownerKey/i);
    expect(guiyeondo.createInvite).toHaveBeenCalledWith(expect.any(Object), ownerUserId, expect.any(String));
  });

  it('recovers only the authenticated owner account invite list', async () => {
    const ownerResponse = await fetch(`${baseUrl}/api/guiyeondo/invites`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    expect(ownerResponse.status).toBe(200);
    expect(await ownerResponse.json()).toEqual({ invites: [invite] });
    expect(guiyeondo.listInvites).toHaveBeenCalledWith(ownerUserId, expect.any(String));

    const otherResponse = await fetch(`${baseUrl}/api/guiyeondo/invites`, {
      headers: { Authorization: `Bearer ${otherToken}` }
    });
    expect(otherResponse.status).toBe(200);
    expect(await otherResponse.json()).toEqual({ invites: [] });
  });

  it('keeps public invite and guest result payloads unauthenticated and profile-free', async () => {
    const publicResponse = await fetch(`${baseUrl}/api/guiyeondo/invites/${publicId}`);
    expect(publicResponse.status).toBe(200);
    expect(await publicResponse.json()).toEqual({ invite });

    const guestResponse = await fetch(`${baseUrl}/api/guiyeondo/invites/${publicId}/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestProfile: { birthDate: '2000-01-01' }, idempotencyKey: 'guest-response-0001' })
    });
    const guestBody = await guestResponse.json();
    expect(guestResponse.status).toBe(201);
    expect(guestBody).toEqual({ person });
    expect(JSON.stringify(guestBody)).not.toMatch(/birthDate|birthTime|privateBirthProfile/);
  });

  it('allows the owner to read and revoke but blocks another valid user token', async () => {
    const ownerResponse = await fetch(`${baseUrl}/api/guiyeondo/invites/${publicId}/responses`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    expect(ownerResponse.status).toBe(200);
    expect(await ownerResponse.json()).toEqual({ people: [person] });
    expect(guiyeondo.listResponses).toHaveBeenCalledWith(publicId, ownerUserId, expect.any(String));

    const forbidden = await fetch(`${baseUrl}/api/guiyeondo/invites/${publicId}/responses`, {
      headers: { Authorization: `Bearer ${otherToken}` }
    });
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toEqual({
      message: '이 초대장을 관리할 권한이 없습니다.',
      code: 'OWNER_ACCOUNT_MISMATCH'
    });

    const revokeResponse = await fetch(`${baseUrl}/api/guiyeondo/invites/${publicId}/revoke`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    expect(revokeResponse.status).toBe(200);
    expect(await revokeResponse.json()).toMatchObject({ ok: true, publicId });
  });

  it('rejects malformed JSON with a masked, actionable 400 response after auth', async () => {
    const response = await fetch(`${baseUrl}/api/guiyeondo/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: '{'
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      message: 'JSON 본문 형식이 올바르지 않습니다.',
      code: 'INVALID_JSON'
    });
  });
});
