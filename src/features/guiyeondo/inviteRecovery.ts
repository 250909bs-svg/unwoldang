import type { GuiyeondoMapState, GuiyeondoOwnedInvite } from './types';

/**
 * 지도가 사라진 브라우저에서 인연을 되살리는 규칙.
 *
 * 지도는 이 브라우저의 localStorage 에만 있다. 그런데 localStorage 는 생각보다 자주
 * 비는데, 기기를 바꿀 때만이 아니다 — iOS Safari 는 7일 넘게 방문하지 않은 사이트의
 * 스크립트 저장소를 지우고, 방문기록 삭제·시크릿 모드도 같은 결과를 낸다. 며칠에 한 번
 * "누가 응답했나" 보러 들어오는 기능에서는 이게 드문 경로가 아니라 흔한 경로다.
 *
 * 되살릴 근거는 서버에 있다. 초대 문서는 만료(최대 14일)까지 남고, 거기 달린 응답은
 * 소유자 토큰으로 다시 받을 수 있다. 따라서 **초대 목록만 복구하면 응답한 사람들은
 * 기존 동기화 경로가 알아서 끌어온다.** 이 모듈은 그 초대 목록을 정리하는 일만 한다.
 *
 * 원시 생년월일시는 서버에 없다(초대·응답 문서에 저장하지 않는다는 것이 이 제품의
 * 약속이다). 그래서 소유자 자신의 출생정보는 되살릴 수 없고, 다시 입력받아야 한다.
 * 손으로 직접 추가한 사람도 서버에 없으므로 돌아오지 않는다.
 */

/** 지도가 추적하는 초대 수 상한. 저장소 한 칸이 무한히 자라지 않게 막는다. */
export const GUIYEONDO_MAX_TRACKED_INVITES = 20;

/** 만료되지 않은 초대만 남기고, 넘치면 최근 것부터 남긴다. */
export function liveGuiyeondoInvites(
  invites: readonly GuiyeondoOwnedInvite[] | undefined,
  now = Date.now()
): GuiyeondoOwnedInvite[] {
  if (!invites?.length) return [];

  return invites
    .filter((invite) => {
      const expiresAt = Date.parse(invite?.expiresAt ?? '');
      return Number.isFinite(expiresAt) && expiresAt > now;
    })
    .slice(-GUIYEONDO_MAX_TRACKED_INVITES);
}

/**
 * 로컬에 있는 초대와 서버가 돌려준 초대를 합친다.
 *
 * 같은 `publicId` 는 서버 값이 이긴다 — 만료 시각이나 응답 수는 서버가 최신이다.
 * 로컬에만 있는 것도 버리지 않는다. 방금 만들어 아직 서버 목록에 안 잡힌 초대가
 * 사라지면, 링크를 보내 놓고 응답을 못 받는 상태가 된다.
 */
export function mergeGuiyeondoOwnedInvites(
  local: readonly GuiyeondoOwnedInvite[] | undefined,
  remote: readonly GuiyeondoOwnedInvite[] | undefined,
  now = Date.now()
): GuiyeondoOwnedInvite[] {
  const byPublicId = new Map<string, GuiyeondoOwnedInvite>();
  for (const invite of local || []) byPublicId.set(invite.publicId, invite);
  for (const invite of remote || []) byPublicId.set(invite.publicId, invite);

  return liveGuiyeondoInvites([...byPublicId.values()], now);
}

/**
 * 두 초대 목록이 같은 것을 가리키는지. 같으면 저장도 렌더도 건너뛴다.
 *
 * `publicId` 만 보지 않고 `expiresAt` 까지 본다. 서버가 만료를 늘려 줬는데 같다고
 * 판단하면 그 갱신이 로컬에 영원히 안 내려온다.
 */
export function sameGuiyeondoInviteSet(
  left: readonly GuiyeondoOwnedInvite[],
  right: readonly GuiyeondoOwnedInvite[]
) {
  if (left.length !== right.length) return false;

  return left.every(
    (invite, index) =>
      invite.publicId === right[index]?.publicId && invite.expiresAt === right[index]?.expiresAt
  );
}

/**
 * 새로 만든 지도에 되살린 초대를 얹는다.
 *
 * 이게 복구의 전부다. `invites` 가 채워지면 소유자 화면의 기존 동기화 효과가
 * 그 초대들의 응답을 받아와 사람으로 붙인다. 복구 전용 경로를 따로 만들지 않는다.
 */
export function withRecoveredInvites(
  map: GuiyeondoMapState,
  recovered: readonly GuiyeondoOwnedInvite[] | undefined,
  now = Date.now()
): GuiyeondoMapState {
  const invites = mergeGuiyeondoOwnedInvites(map.invites, recovered, now);
  if (sameGuiyeondoInviteSet(map.invites, invites)) return map;

  return { ...map, invites };
}
