import { describe, expect, it } from 'vitest';
import {
  attachGuiyeondoConnectionId,
  connectionToPerson,
  directConnectionIdempotencyKey,
  mergeGuiyeondoConnections
} from './connections';
import type { GuiyeondoConnection, GuiyeondoMapState, GuiyeondoPerson } from './types';

/**
 * 계정에 남은 인연을 지도에 합치는 규칙.
 *
 * 이 파일이 지키는 것은 "돌아온다" 와 "돌아오지 않는다" 의 경계다. 동기화가 너무 세면
 * 방금 추가한 사람이 사라지고, 너무 약하면 다른 기기에서 지운 사람이 되살아난다.
 */
const analysis = { classification: { type: null } } as unknown as GuiyeondoPerson['analysis'];

function connection(overrides: Partial<GuiyeondoConnection> = {}): GuiyeondoConnection {
  return {
    connectionId: 'c'.repeat(64),
    personId: 'p1',
    kind: 'invite',
    name: '응답자',
    role: 'host',
    createdAt: '2026-09-20T00:00:00.000Z',
    analysis,
    ...overrides
  };
}

function person(overrides: Partial<GuiyeondoPerson> = {}): GuiyeondoPerson {
  return {
    id: 'p1',
    name: '사람',
    source: 'direct',
    createdAt: '2026-09-20T00:00:00.000Z',
    analysis,
    ...overrides
  };
}

function map(people: GuiyeondoPerson[], hidden: string[] = []): GuiyeondoMapState {
  return {
    version: 1,
    owner: { name: '나' } as GuiyeondoMapState['owner'],
    people,
    hiddenInvitePersonIds: hidden,
    invites: [],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z'
  };
}

describe('계정 인연을 지도에 합치기', () => {
  it('인연에서 온 사람에게는 만료가 없다', () => {
    /* 만료가 붙으면 저장소가 14일 뒤에 지운다. 그게 원래 문제였다. */
    expect(connectionToPerson(connection())).not.toHaveProperty('expiresAt', expect.anything());
    expect(connectionToPerson(connection()).expiresAt).toBeUndefined();
    expect(connectionToPerson(connection()).connectionId).toBe('c'.repeat(64));
  });

  it('내가 응답한 쪽이면 문장 방향을 뒤집어 둔다', () => {
    /* 계산은 초대한 쪽을 personA 로 놓고 됐다. 표시가 그대로면 두 사람이 뒤바뀐다. */
    expect(connectionToPerson(connection({ role: 'guest' })).reversed).toBe(true);
    expect(connectionToPerson(connection({ role: 'host' })).reversed).toBe(false);
  });

  it('빈 지도를 서버의 인연으로 채운다', () => {
    const next = mergeGuiyeondoConnections(map([]), [connection()]);

    expect(next.people).toHaveLength(1);
    expect(next.people[0]).toMatchObject({ id: 'p1', name: '응답자', source: 'invite' });
  });

  it('아직 못 올린 사람은 건드리지 않는다', () => {
    /*
     * 방금 추가했는데 서버 요청이 실패했을 수 있다. `connectionId` 가 없는 사람을
     * "서버에 없으니 지운다" 로 처리하면, 막 만든 인연이 눈앞에서 사라진다.
     */
    const local = person({ id: 'local-1', connectionId: undefined });
    const next = mergeGuiyeondoConnections(map([local]), [connection()]);

    expect(next.people.map((item) => item.id)).toEqual(['local-1', 'p1']);
  });

  it('한 번 올렸던 사람이 서버에 없으면 지운다', () => {
    /* 다른 기기에서 지운 것이다. 여기서도 없어져야 같은 지도라고 말할 수 있다. */
    const synced = person({ id: 'p-gone', connectionId: 'd'.repeat(64) });
    const next = mergeGuiyeondoConnections(map([synced]), [connection()]);

    expect(next.people.map((item) => item.id)).toEqual(['p1']);
  });

  it('같은 사람은 서버 값으로 덮되 이번 세션의 출생정보는 지킨다', () => {
    const local = person({
      id: 'p1',
      name: '옛 이름',
      connectionId: 'c'.repeat(64),
      privateBirthProfile: { name: '옛 이름' } as GuiyeondoPerson['privateBirthProfile']
    });
    const next = mergeGuiyeondoConnections(map([local]), [connection({ name: '새 이름' })]);

    expect(next.people).toHaveLength(1);
    expect(next.people[0].name).toBe('새 이름');
    /* 저장되지는 않지만 상세 화면이 이번 세션에서 쓰는 값이다. 동기화가 뺏을 이유가 없다. */
    expect(next.people[0].privateBirthProfile).toEqual({ name: '옛 이름' });
  });

  it('치운 사람은 동기화 한 번에 돌아오지 않는다', () => {
    /* 돌아오면 치운 적이 없는 것과 같다. */
    const next = mergeGuiyeondoConnections(map([], ['p1']), [connection()]);

    expect(next.people).toEqual([]);
  });

  it('100명을 넘기지 않는다', () => {
    const many = Array.from({ length: 120 }, (_, index) => connection({
      personId: `p${index}`,
      connectionId: `${index}`.padStart(64, '0')
    }));

    expect(mergeGuiyeondoConnections(map([]), many).people).toHaveLength(100);
  });

  it('올린 뒤에는 서버가 준 식별자를 달아 둔다', () => {
    const next = attachGuiyeondoConnectionId(
      map([person({ id: 'local-1' })]),
      'local-1',
      connection({ personId: 'server-1' })
    );

    expect(next.people[0].id).toBe('server-1');
    expect(next.people[0].connectionId).toBe('c'.repeat(64));
  });

  it('없는 사람에게 식별자를 달려고 하면 지도를 그대로 둔다', () => {
    const state = map([person({ id: 'local-1' })]);
    expect(attachGuiyeondoConnectionId(state, 'missing', connection())).toBe(state);
  });

  it('멱등키는 서버의 형식 규칙을 만족한다', () => {
    /* 서버는 /^[A-Za-z0-9._:-]{16,128}$/ 만 받는다. 어긋나면 400 이 돌아온다. */
    const key = directConnectionIdempotencyKey('a'.repeat(32));
    expect(key).toMatch(/^[A-Za-z0-9._:-]{16,128}$/);
  });
});
