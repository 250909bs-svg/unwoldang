import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../cloudrun-api/src/app.ts';
import { loadConfig } from '../../../cloudrun-api/src/config/env.ts';
import type { GuiyeondoApi } from '../../../cloudrun-api/src/domains/guiyeondo/guiyeondoService.ts';

const publicId = 'a'.repeat(32);
const ownerKey = 'b'.repeat(64);
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
  createInvite: vi.fn(async () => ({ invite, ownerKey })),
  getInvite: vi.fn(async () => ({ invite })),
  submitResponse: vi.fn(async () => ({ person })),
  listResponses: vi.fn(async (_publicId, key) => {
    if (key !== ownerKey) {
      const error = new Error('초대 관리 권한이 필요합니다.') as Error & { status: number; code: string };
      error.status = 401;
      error.code = 'OWNER_KEY_REQUIRED';
      throw error;
    }
    return { people: [person] };
  }),
  revokeInvite: vi.fn(async () => ({
    ok: true,
    publicId,
    revokedAt: '2026-09-15T00:02:00.000Z'
  }))
};

let server: Server;
let baseUrl = '';

beforeAll(async () => {
  server = createServer(createApp({
    config: loadConfig({ NODE_ENV: 'development', ALLOW_UNVERIFIED_REPORTS: 'true' }),
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

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

describe('Cloud Run Guiyeondo HTTP contract', () => {
  it('creates an invite without exposing natal or birth input', async () => {
    const response = await fetch(`${baseUrl}/api/guiyeondo/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerProfile: { name: '초대자', birthDate: '1992-09-09' } })
    });
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body).toEqual({ invite, ownerKey });
    expect(JSON.stringify(body.invite)).not.toMatch(/birth|natal|ownerKey/i);
  });

  it('keeps public invite and guest result payloads free of source profiles', async () => {
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

  it('passes the owner capability only through Authorization and supports revoke', async () => {
    const ownerResponse = await fetch(`${baseUrl}/api/guiyeondo/invites/${publicId}/responses`, {
      headers: { Authorization: `Bearer ${ownerKey}` }
    });
    expect(ownerResponse.status).toBe(200);
    expect(await ownerResponse.json()).toEqual({ people: [person] });
    expect(guiyeondo.listResponses).toHaveBeenCalledWith(publicId, ownerKey, expect.any(String));

    const revokeResponse = await fetch(`${baseUrl}/api/guiyeondo/invites/${publicId}/revoke`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerKey}` }
    });
    expect(revokeResponse.status).toBe(200);
    expect(await revokeResponse.json()).toMatchObject({ ok: true, publicId });
  });

  it('rejects malformed JSON with a masked, actionable 400 response', async () => {
    const response = await fetch(`${baseUrl}/api/guiyeondo/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{'
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      message: 'JSON 본문 형식이 올바르지 않습니다.',
      code: 'INVALID_JSON'
    });
  });
});
