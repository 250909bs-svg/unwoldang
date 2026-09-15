import { describe, expect, it } from 'vitest';
import { ReportRequestError } from '../../../cloudrun-api/src/contracts/errors.ts';
import { GuiyeondoFirestoreRepository } from '../../../cloudrun-api/src/repositories/guiyeondoRepository.ts';
import type { FirestoreRepository } from '../../../cloudrun-api/src/repositories/firestoreRepository.ts';
import type { StoredGuiyeondoInvite, StoredGuiyeondoResponse } from '../../../cloudrun-api/src/domains/guiyeondo/guiyeondoService.ts';

function fixture() {
  const calls: Array<{ path: string; body: unknown }> = [];
  let fail = false;
  const firestore = {
    documentName(collection: string, id: string) {
      return `projects/test/databases/(default)/documents/${collection}/${id}`;
    },
    async request(path: string, init: { body?: string } = {}) {
      calls.push({ path, body: init.body ? JSON.parse(init.body) : null });
      if (fail) throw new ReportRequestError(409, 'precondition failed');
      return {};
    }
  } as unknown as FirestoreRepository;
  return {
    repository: new GuiyeondoFirestoreRepository(firestore, 'guiyeondoInvites', 'guiyeondoResponses', 'guiyeondoRateLimits'),
    calls,
    setConflict() { fail = true; }
  };
}

const invite = {
  publicId: 'a'.repeat(32),
  hostName: '초대자',
  natalSnapshot: { yGz: { tg: '壬', dz: '申' }, mGz: { tg: '己', dz: '酉' }, dGz: { tg: '戊', dz: '子' }, hGz: null, status: 'partial', calendarVersion: 'calendar-v2.2.0' },
  sigilSeed: 'gy-test',
  ownerKeyHash: 'b'.repeat(64),
  createdAt: '2026-09-15T00:00:00Z',
  expiresAt: '2026-09-29T00:00:00Z',
  revokedAt: '',
  responseCount: 2,
  updateTime: '2026-09-15T01:00:00Z'
} as StoredGuiyeondoInvite;

const response = {
  responseId: 'c'.repeat(64),
  publicId: invite.publicId,
  expiresAt: invite.expiresAt,
  requestFingerprint: 'd'.repeat(64),
  consentVersion: 'guiyeondo-share-v1',
  consentedAt: '2026-09-15T01:00:00Z',
  person: { id: 'c'.repeat(64), name: '응답자', source: 'invite', createdAt: '2026-09-15T01:00:00Z', expiresAt: invite.expiresAt, analysis: {} }
} as StoredGuiyeondoResponse;

describe('Guiyeondo Firestore atomic response commit', () => {
  it('creates response and increments invite count in one conditional commit', async () => {
    const { repository, calls } = fixture();
    expect(await repository.createResponseWithSlot(invite, response)).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.path).toBe(':commit');
    const body = calls[0]?.body as { writes: Array<Record<string, unknown>> };
    expect(body.writes).toHaveLength(2);
    expect(body.writes[0]?.currentDocument).toEqual({ exists: false });
    expect(body.writes[1]?.updateMask).toEqual({ fieldPaths: ['responseCount'] });
    expect(body.writes[1]?.currentDocument).toEqual({ updateTime: invite.updateTime });
    expect((body.writes[1]?.update as { fields: { responseCount: { integerValue: string } } }).fields.responseCount.integerValue).toBe('3');
    const responseFields = (body.writes[0]?.update as { fields: Record<string, unknown> }).fields;
    expect(responseFields.consentVersion).toEqual({ stringValue: 'guiyeondo-share-v1' });
    expect(responseFields.consentedAt).toEqual({ timestampValue: '2026-09-15T01:00:00Z' });
  });

  it('reports a precondition conflict without a partial success', async () => {
    const { repository, calls, setConflict } = fixture();
    setConflict();
    expect(await repository.createResponseWithSlot(invite, response)).toBe(false);
    expect(calls).toHaveLength(1);
  });
});

describe('Firestore error normalization', () => {
  it('maps the Firestore FAILED_PRECONDITION envelope to a retryable 412', async () => {
    const { FirestoreRepository: Repository } = await import('../../../cloudrun-api/src/repositories/firestoreRepository.ts');
    const firestore = new Repository({
      enabled: true,
      projectId: 'test',
      databaseId: '(default)',
      archiveCollection: 'archives',
      accessToken: 'test-token'
    }, async () => new Response(JSON.stringify({
      error: { status: 'FAILED_PRECONDITION', message: 'The stored version does not match.' }
    }), { status: 400, headers: { 'Content-Type': 'application/json' } }));

    await expect(firestore.request(':commit', { method: 'POST', body: '{}' }))
      .rejects.toMatchObject({ status: 412 });
  });

  it('reports an upstream INVALID_ARGUMENT as a server-side gateway failure, not client JSON', async () => {
    const { FirestoreRepository: Repository } = await import('../../../cloudrun-api/src/repositories/firestoreRepository.ts');
    const firestore = new Repository({
      enabled: true,
      projectId: 'test',
      databaseId: '(default)',
      archiveCollection: 'archives',
      accessToken: 'test-token'
    }, async () => new Response(JSON.stringify({
      error: { status: 'INVALID_ARGUMENT', message: 'Invalid request.' }
    }), { status: 400, headers: { 'Content-Type': 'application/json' } }));

    await expect(firestore.request(':commit', { method: 'POST', body: '{}' }))
      .rejects.toMatchObject({ status: 502 });
  });
});
