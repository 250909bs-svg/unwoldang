import { describe, expect, it } from 'vitest';
import {
  GuiyeondoService,
  type GuiyeondoRepository,
  type StoredGuiyeondoConnection,
  type StoredGuiyeondoInvite,
  type StoredGuiyeondoResponse
} from '../../../cloudrun-api/src/domains/guiyeondo/guiyeondoService.ts';

/**
 * 인연 문서의 계약 — 초대보다 오래 사는 것.
 *
 * 초대 링크는 14일에 닫힌다. 그건 맞는 설계다(보낸 주소가 영원히 열려 있으면 안 된다).
 * 문제는 **맺어진 인연까지 같이 닫히던 것**이었다. 이 파일이 지키는 것은 그 분리다.
 *
 * 함께 지키는 것이 하나 더 있다. 인연 문서가 오래 남는 대신, 거기에 **원시 생년월일시도
 * 명식 스냅숏도 들어가지 않는다.** 낯선 사람이 생년월일시를 넣어 주는 유일한 근거가 그
 * 약속이라, 보관 기간을 늘리면서 담는 것까지 늘리면 바꾼 의미가 없다.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const HOST_USER_ID = 'kakao-host';
const GUEST_USER_ID = 'kakao-guest';
const STRANGER_USER_ID = 'kakao-stranger';

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

class MemoryRepository implements GuiyeondoRepository {
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
    this.invites.set(invite.publicId, { ...current, revokedAt, updateTime: `v${++this.version}` });
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

function fixture() {
  const repository = new MemoryRepository();
  let clock = Date.parse('2026-09-15T00:00:00.000Z');
  let serial = 0;
  const service = new GuiyeondoService({
    repository,
    config: {
      enabled: true,
      inviteTtlMs: 14 * DAY_MS,
      rateLimitWindowMs: 60_000,
      createRateLimitMax: 500,
      readRateLimitMax: 500,
      responseRateLimitMax: 500,
      ownerRateLimitMax: 500
    },
    now: () => new Date(clock),
    /* 초대마다 다른 publicId 가 나와야 한다. 고정값을 쓰면 두 번째 초대가 조용히 실패한다. */
    randomHex: () => String(serial += 1).padStart(32, '0')
  });
  return { service, repository, advance(ms: number) { clock += ms; } };
}

/** 링크를 만들고, 손님이 영구 보관 동의로 응답하는 데까지. */
async function connected() {
  const context = fixture();
  const created = await context.service.createInvite(
    { ownerProfile: profile('초대자') },
    HOST_USER_ID,
    '198.51.100.1'
  );
  const idempotencyKey = 'guest-response-0001';
  const answered = await context.service.submitResponse(created.invite.publicId, {
    guestProfile: profile('응답자', '2000-01-01', '09:10'),
    idempotencyKey,
    consentVersion: 'guiyeondo-share-v2'
  }, '198.51.100.2');

  return { ...context, publicId: created.invite.publicId, idempotencyKey, answered };
}

describe('귀연도 인연 문서', () => {
  it('영구 보관 동의로 응답하면 초대가 만료된 뒤에도 인연이 남는다', async () => {
    const { service, advance, answered } = await connected();

    expect(answered.keepable).toBe(true);

    /* 링크는 닫히고 */
    advance(15 * DAY_MS);

    /* 인연은 남는다. 이것이 이 변경의 전부다. */
    const mine = await service.listConnections(HOST_USER_ID, '198.51.100.1');
    expect(mine.connections).toHaveLength(1);
    expect(mine.connections[0]).toMatchObject({ name: '응답자', role: 'host', kind: 'invite' });
  });

  it('예전 동의(v1)로 들어온 응답은 인연으로 넘어가지 않는다', async () => {
    /*
     * v1 동의 문구는 "초대 만료일(최대 14일)까지 보관" 이었다. 나중에 정책을 바꿨다고
     * 해서 그때 받은 동의의 범위가 넓어지지는 않는다. 그래서 v1 응답은 예전처럼 만료된다.
     */
    const { service, repository } = fixture();
    const created = await service.createInvite({ ownerProfile: profile('초대자') }, HOST_USER_ID, '198.51.100.1');
    const answered = await service.submitResponse(created.invite.publicId, {
      guestProfile: profile('응답자', '2000-01-01', '09:10'),
      idempotencyKey: 'guest-response-0002',
      consentVersion: 'guiyeondo-share-v1'
    }, '198.51.100.2');

    expect(answered.keepable).toBe(false);
    expect(repository.connections.size).toBe(0);
    expect((await service.listConnections(HOST_USER_ID, '198.51.100.1')).connections).toEqual([]);
  });

  it('인연 문서에는 생년월일시도 명식도 들어가지 않는다', async () => {
    const { repository } = await connected();

    const serialized = JSON.stringify([...repository.connections.values()]);
    expect(serialized).not.toContain('1992-09-09');
    expect(serialized).not.toContain('2000-01-01');
    expect(serialized).not.toContain('10:24');
    expect(serialized).not.toContain('09:10');
    expect(serialized).not.toContain('Asia/Seoul');
    expect(serialized).not.toMatch(/natalSnapshot|yGz|mGz|dGz|hGz/);
    /* 계정 식별자도 원문으로는 남지 않는다. */
    expect(serialized).not.toContain(HOST_USER_ID);
    expect(serialized).not.toContain(GUEST_USER_ID);
  });

  it('응답한 사람이 로그인해서 자기 몫을 가져가면 둘 다 서로를 본다', async () => {
    const { service, publicId, idempotencyKey } = await connected();

    const claimed = await service.claimConnection({ publicId, idempotencyKey }, GUEST_USER_ID, '198.51.100.2');
    expect(claimed.connection).toMatchObject({ name: '초대자', role: 'guest' });

    const host = await service.listConnections(HOST_USER_ID, '198.51.100.1');
    const guest = await service.listConnections(GUEST_USER_ID, '198.51.100.2');

    /* 같은 인연을 서로 상대의 이름으로 본다. */
    expect(host.connections[0].connectionId).toBe(guest.connections[0].connectionId);
    expect(host.connections[0].name).toBe('응답자');
    expect(guest.connections[0].name).toBe('초대자');
  });

  it('증표를 모르는 사람은 남의 인연을 가져갈 수 없다', async () => {
    const { service, publicId } = await connected();

    /* 링크(publicId)는 공개값이다. 멱등키를 모르면 가져갈 수 없어야 한다 —
       그렇지 않으면 링크를 받은 누구나 남의 결과를 자기 지도에 담게 된다. */
    await expect(service.claimConnection(
      { publicId, idempotencyKey: 'someone-elses-key-0001' },
      STRANGER_USER_ID,
      '198.51.100.9'
    )).rejects.toMatchObject({ status: 404, code: 'CONNECTION_NOT_FOUND' });
  });

  it('이미 가져간 인연은 다른 계정이 가로챌 수 없고, 같은 계정은 다시 불러도 된다', async () => {
    const { service, publicId, idempotencyKey } = await connected();

    await service.claimConnection({ publicId, idempotencyKey }, GUEST_USER_ID, '198.51.100.2');
    /* 같은 사람이 다시 눌러도 조용히 같은 결과 — 두 번 누르는 것은 흔한 일이다. */
    await expect(service.claimConnection({ publicId, idempotencyKey }, GUEST_USER_ID, '198.51.100.2'))
      .resolves.toMatchObject({ connection: { role: 'guest' } });

    await expect(service.claimConnection({ publicId, idempotencyKey }, STRANGER_USER_ID, '198.51.100.9'))
      .rejects.toMatchObject({ status: 409, code: 'CONNECTION_ALREADY_CLAIMED' });
  });

  it('자기 초대에 자기가 응답한 경우는 가져가지 않는다', async () => {
    const { service, publicId, idempotencyKey } = await connected();

    await expect(service.claimConnection({ publicId, idempotencyKey }, HOST_USER_ID, '198.51.100.1'))
      .rejects.toMatchObject({ status: 409, code: 'CONNECTION_SELF_CLAIM' });
  });

  it('한쪽이 지워도 상대 지도에는 남고, 둘 다 지우면 문서가 사라진다', async () => {
    const { service, repository, publicId, idempotencyKey } = await connected();
    await service.claimConnection({ publicId, idempotencyKey }, GUEST_USER_ID, '198.51.100.2');
    const connectionId = [...repository.connections.keys()][0];

    await service.removeConnection(connectionId, GUEST_USER_ID, '198.51.100.2');

    /* 그 관계는 상대의 것이기도 하다. 한쪽이 치웠다고 상대 지도에서 지우지 않는다. */
    expect((await service.listConnections(GUEST_USER_ID, '198.51.100.2')).connections).toEqual([]);
    expect((await service.listConnections(HOST_USER_ID, '198.51.100.1')).connections).toHaveLength(1);
    expect(repository.connections.size).toBe(1);

    await service.removeConnection(connectionId, HOST_USER_ID, '198.51.100.1');

    /* 아무도 보지 않는 계산을 서버가 계속 들고 있을 이유가 없다. */
    expect(repository.connections.size).toBe(0);
  });

  it('구성원이 아닌 계정은 인연을 지울 수 없다', async () => {
    const { service, repository } = await connected();
    const connectionId = [...repository.connections.keys()][0];

    await expect(service.removeConnection(connectionId, STRANGER_USER_ID, '198.51.100.9'))
      .rejects.toMatchObject({ status: 403, code: 'CONNECTION_FORBIDDEN' });
    expect(repository.connections.size).toBe(1);
  });

  it('직접 넣은 사람도 계정에 남지만 상대의 출생정보는 저장하지 않는다', async () => {
    const { service, repository } = fixture();

    const created = await service.createDirectConnection({
      ownerProfile: profile('나'),
      guestProfile: profile('직접 넣은 사람', '1988-03-03', '07:40'),
      idempotencyKey: 'direct-person-0001'
    }, HOST_USER_ID, '198.51.100.1');

    expect(created.connection).toMatchObject({ name: '직접 넣은 사람', kind: 'direct', role: 'host' });

    const serialized = JSON.stringify([...repository.connections.values()]);
    expect(serialized).not.toContain('1988-03-03');
    expect(serialized).not.toContain('07:40');
    expect(serialized).not.toMatch(/natalSnapshot|yGz|dGz/);

    /* 같은 멱등키로 다시 부르면 하나로 유지된다 — 새로고침이 사람을 둘로 만들지 않는다. */
    await service.createDirectConnection({
      ownerProfile: profile('나'),
      guestProfile: profile('직접 넣은 사람', '1988-03-03', '07:40'),
      idempotencyKey: 'direct-person-0001'
    }, HOST_USER_ID, '198.51.100.1');
    expect(repository.connections.size).toBe(1);
  });

  it('직접 넣은 사람은 가져갈 증표가 없다', async () => {
    /* `claimTicket` 이 비어 있어야 한다. 비어 있지 않으면 계산해 낼 수 있는 값으로
       남의 지도에 자신을 끼워 넣는 경로가 생긴다. */
    const { service, repository } = fixture();
    await service.createDirectConnection({
      ownerProfile: profile('나'),
      guestProfile: profile('직접 넣은 사람', '1988-03-03', '07:40'),
      idempotencyKey: 'direct-person-0002'
    }, HOST_USER_ID, '198.51.100.1');

    expect([...repository.connections.values()][0].claimTicket).toBe('');
  });

  it('상대 계정 식별자는 어느 쪽 응답에도 실려 나가지 않는다', async () => {
    const { service, publicId, idempotencyKey } = await connected();
    await service.claimConnection({ publicId, idempotencyKey }, GUEST_USER_ID, '198.51.100.2');

    const host = JSON.stringify(await service.listConnections(HOST_USER_ID, '198.51.100.1'));
    const guest = JSON.stringify(await service.listConnections(GUEST_USER_ID, '198.51.100.2'));

    for (const payload of [host, guest]) {
      expect(payload).not.toMatch(/memberHashes|ownerHash|claimTicket/);
    }
  });
});
