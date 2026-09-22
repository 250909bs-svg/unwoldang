import type { GuiyeondoConnection, GuiyeondoMapState, GuiyeondoPerson } from './types';

/**
 * 계정에 남은 인연을 이 브라우저의 지도에 얹는 규칙.
 *
 * 지금까지 지도는 이 브라우저에만 있었다. 그래서 저장소가 비면 —  기기를 바꿀 때만이
 * 아니라 iOS Safari 의 7일 정리, 방문기록 삭제, 시크릿 모드에서도 — 쌓아 온 인연이
 * 사라졌다. 게다가 초대로 들어온 사람은 브라우저를 그대로 둬도 14일이면 지도에서
 * 빠졌다. 초대 링크의 수명이 곧 인연의 수명이었기 때문이다.
 *
 * 이제 링크와 인연을 나눈다. **링크는 14일에 닫히고, 인연은 계정에 남는다.**
 * 서버가 들고 있는 것은 이름과 계산된 관계뿐이라, 오래 남기면서도 담는 것은 늘리지
 * 않는다 — 원시 생년월일시도 명식도 서버에 저장하지 않는다는 약속이 낯선 사람이
 * 생년월일시를 넣어 주는 유일한 근거다.
 */

/** 직접 넣은 사람을 서버에 남길 때 쓰는 멱등키. 로컬 사람 id 하나에 인연 하나. */
export function directConnectionIdempotencyKey(personId: string) {
  return `gy-direct-${personId}`;
}

/**
 * 인연 한 건을 지도의 사람으로 옮긴다.
 *
 * `expiresAt` 을 **일부러 넣지 않는다.** 그 값이 있으면 저장소가 만료를 검사해서 지우는데,
 * 인연은 초대와 달리 만료되지 않는 것이 이 변경의 요점이다.
 */
export function connectionToPerson(connection: GuiyeondoConnection): GuiyeondoPerson {
  return {
    id: connection.personId,
    connectionId: connection.connectionId,
    name: connection.name,
    source: connection.kind === 'direct' ? 'direct' : 'invite',
    createdAt: connection.createdAt,
    /* 내가 응답한 쪽이면 계산은 상대를 앞에 놓고 됐다. 그대로 풀면 이름이 뒤바뀐다. */
    reversed: connection.role === 'guest',
    analysis: connection.analysis
  };
}

/**
 * 서버의 인연 목록을 지도에 합친다.
 *
 * 세 가지를 지킨다.
 *
 *   1) **서버가 최신이다.** 같은 사람이면 서버 값으로 덮는다. 이름을 고쳤거나 다른
 *      기기에서 바뀐 것이 여기로 들어온다.
 *   2) **아직 못 올린 사람은 지키지 않고 버리지 않는다.** 방금 추가했는데 요청이
 *      실패했을 수 있다. `connectionId` 가 없는 사람은 손대지 않는다.
 *   3) **한 번 올렸다가 서버에서 사라진 사람은 지운다.** 다른 기기에서 지운 것이므로
 *      여기서도 없어져야 한다. 이 판단은 `connectionId` 가 있는 사람에게만 한다.
 *
 * 숨긴 사람(`hiddenInvitePersonIds`)은 서버에 남아 있어도 다시 올리지 않는다. 치운 것이
 * 동기화 한 번에 돌아오면 치운 적이 없는 것과 같다.
 */
export function mergeGuiyeondoConnections(
  state: GuiyeondoMapState,
  connections: readonly GuiyeondoConnection[]
): GuiyeondoMapState {
  const hidden = new Set(state.hiddenInvitePersonIds || []);
  const live = connections.filter((connection) => !hidden.has(connection.personId));
  const livePersonIds = new Set(live.map((connection) => connection.personId));

  const people = new Map<string, GuiyeondoPerson>();

  for (const person of state.people) {
    /* 올린 적 있는데 서버에 없다 = 다른 기기에서 지웠다. */
    if (person.connectionId && !livePersonIds.has(person.id)) continue;
    people.set(person.id, person);
  }

  for (const connection of live) {
    const local = people.get(connection.personId);
    people.set(connection.personId, {
      ...connectionToPerson(connection),
      /* 계산 직후의 출생정보는 상세 화면이 쓰는 휘발성 값이다. 저장은 되지 않지만
         이번 세션에서 들고 있던 것까지 동기화가 빼앗을 이유는 없다. */
      privateBirthProfile: local?.privateBirthProfile
    });
  }

  return { ...state, people: [...people.values()].slice(-100) };
}

/** 방금 서버에 올린 사람에게 인연 식별자를 달아 준다. 다음 동기화가 이 사람을 알아본다. */
export function attachGuiyeondoConnectionId(
  state: GuiyeondoMapState,
  personId: string,
  connection: GuiyeondoConnection
): GuiyeondoMapState {
  if (!state.people.some((person) => person.id === personId)) return state;

  return {
    ...state,
    people: state.people.map((person) => person.id === personId
      ? { ...person, id: connection.personId, connectionId: connection.connectionId }
      : person)
  };
}
