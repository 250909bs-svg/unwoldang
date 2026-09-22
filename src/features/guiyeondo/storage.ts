import { createSecureRandomPart } from '../../shared/security/secureRandom';
import type {
  GuiyeondoBirthProfile,
  GuiyeondoMapState,
  GuiyeondoOwnedInvite,
  GuiyeondoPerson
} from './types';

const MAP_PREFIX = 'unwoldang.guiyeondo.preview.v1';
const PREVIEW_OWNER_ID_PATTERN = /^preview-[a-f0-9]{32}$/i;

function safeOwnerId(ownerId?: string) {
  return ownerId?.trim().replace(/[^a-zA-Z0-9._@=-]/g, '') || 'guest';
}

function mapKey(ownerId?: string) {
  return `${MAP_PREFIX}.${safeOwnerId(ownerId)}`;
}

export function createGuiyeondoPreviewOwnerId() {
  return `preview-${createSecureRandomPart()}`;
}

export function normalizeGuiyeondoPreviewOwnerId(value: string | null) {
  return value && PREVIEW_OWNER_ID_PATTERN.test(value) ? value.toLowerCase() : undefined;
}

export function guiyeondoPreviewOwnerPath(ownerId: string) {
  const normalized = normalizeGuiyeondoPreviewOwnerId(ownerId);
  if (!normalized) throw new Error('유효하지 않은 귀연도 로컬 지도 ID입니다.');
  return `/guiyeondo?owner=${encodeURIComponent(normalized)}`;
}

/**
 * 지도에 남겨 둘 사람인지.
 *
 * 규칙이 셋으로 갈린다.
 *
 *   - 직접 넣은 사람은 만료가 없다. 예전부터 그랬다.
 *   - **초대로 들어왔지만 `expiresAt` 이 없는 사람은 남긴다.** 계정의 인연 문서로 넘어온
 *     사람이다. 초대 링크는 14일에 닫혀도 맺어진 인연까지 닫힐 이유는 없다.
 *   - `expiresAt` 이 붙어 있는 사람만 그 시각에 지운다. 예전 동의(`guiyeondo-share-v1`,
 *     "초대 만료일까지 보관")로 들어온 사람이라, 그때 받은 동의대로 사라져야 한다.
 *
 * 세 번째가 남아 있는 이유가 중요하다. 나중에 정책을 바꿨다고 해서 이미 받은 동의의
 * 범위가 넓어지지는 않는다.
 */
function isUnexpiredInvitePerson(person: GuiyeondoPerson, now = Date.now()) {
  if (person.source !== 'invite') return true;
  if (typeof person.expiresAt !== 'string' || !person.expiresAt) return true;
  const expiresAt = Date.parse(person.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > now;
}

export function createGuiyeondoMap(owner: GuiyeondoBirthProfile): GuiyeondoMapState {
  const now = new Date().toISOString();
  return { version: 1, owner, people: [], hiddenInvitePersonIds: [], invites: [], createdAt: now, updatedAt: now };
}

export function readGuiyeondoMap(ownerId?: string): GuiyeondoMapState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(mapKey(ownerId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuiyeondoMapState;
    if (parsed?.version !== 1 || !parsed.owner?.name || !Array.isArray(parsed.people)) return null;
    const people = parsed.people.filter((person) => person && isUnexpiredInvitePerson(person));
    const invites = Array.isArray(parsed.invites)
      ? parsed.invites.filter((invite) => isOwnedInvite(invite) && Date.parse(invite.expiresAt) > Date.now())
      : [];
    const next = {
      ...parsed,
      people,
      hiddenInvitePersonIds: Array.isArray(parsed.hiddenInvitePersonIds)
        ? parsed.hiddenInvitePersonIds.filter((id): id is string => typeof id === 'string' && /^[a-f0-9]{64}$/.test(id))
        : [],
      invites
    };
    if (people.length !== parsed.people.length || invites.length !== (parsed.invites?.length || 0)) {
      next.updatedAt = new Date().toISOString();
      window.localStorage.setItem(mapKey(ownerId), JSON.stringify(next));
    }
    return next;
  } catch {
    try { window.localStorage.removeItem(mapKey(ownerId)); } catch { /* unavailable storage */ }
    return null;
  }
}

function isOwnedInvite(value: unknown): value is GuiyeondoOwnedInvite {
  if (!value || typeof value !== 'object') return false;
  const invite = value as Partial<GuiyeondoOwnedInvite>;
  return /^[a-f0-9]{32}$/i.test(invite.publicId || '')
    && Boolean(invite.hostName && invite.createdAt && invite.expiresAt && invite.sigilSeed);
}

export function saveGuiyeondoMap(state: GuiyeondoMapState, ownerId?: string) {
  const next = { ...state, updatedAt: new Date().toISOString() };
  try {
    window.localStorage.setItem(mapKey(ownerId), JSON.stringify(next));
    return next;
  } catch {
    throw new Error('귀연도 정보를 이 브라우저에 저장하지 못했습니다. 저장 공간과 개인정보 보호 설정을 확인해 주세요.');
  }
}

export function addGuiyeondoPerson(
  state: GuiyeondoMapState,
  person: GuiyeondoPerson,
  ownerId?: string
) {
  const identity = `${person.name.trim().toLocaleLowerCase('ko-KR')}|${person.analysis.calculationFingerprint}`;
  const withoutDuplicate = state.people.filter((item) => {
    const itemIdentity = `${item.name.trim().toLocaleLowerCase('ko-KR')}|${item.analysis.calculationFingerprint}`;
    return item.id !== person.id && itemIdentity !== identity;
  });
  if (withoutDuplicate.length >= 100) throw new Error('귀연도에는 인연을 최대 100명까지 저장할 수 있습니다.');
  const storedPerson = { ...person };
  delete storedPerson.privateBirthProfile;
  return saveGuiyeondoMap({ ...state, people: [...withoutDuplicate, storedPerson] }, ownerId);
}

export function mergeGuiyeondoInvitePeople(
  state: GuiyeondoMapState,
  people: GuiyeondoPerson[],
  ownerId?: string
) {
  const now = Date.now();
  const merged = new Map(state.people.filter((person) => isUnexpiredInvitePerson(person, now)).map((person) => [person.id, person]));
  const hidden = new Set(state.hiddenInvitePersonIds || []);
  for (const person of people) {
    if (person.source !== 'invite' || person.privateBirthProfile || hidden.has(person.id)
      || !isUnexpiredInvitePerson(person, now)) continue;
    /*
     * 같은 사람이 두 경로로 들어온다. 초대 응답 목록은 초대의 만료 시각을 달고 오고,
     * 인연 목록은 만료 없이 온다. 응답 목록이 나중에 도착했다고 해서 이미 계정에
     * 남은 사람에게 만료를 도로 붙이면, 14일 뒤 지도에서 사라지던 옛 동작으로 돌아간다.
     */
    const known = merged.get(person.id);
    merged.set(person.id, known?.connectionId
      ? { ...person, connectionId: known.connectionId, expiresAt: undefined }
      : person);
  }
  return saveGuiyeondoMap({ ...state, people: [...merged.values()].slice(-100) }, ownerId);
}

export function removeGuiyeondoPerson(state: GuiyeondoMapState, personId: string, ownerId?: string) {
  const person = state.people.find((item) => item.id === personId);
  /*
   * 서버에서 다시 내려올 수 있는 사람은 지웠다는 사실을 기록해 둔다.
   *
   * 초대 응답이 그랬고, 이제는 **계정에 남은 사람(`connectionId`)도** 그렇다. 서버 쪽
   * 삭제가 실패하거나 늦으면 다음 동기화가 그 사람을 다시 얹는데, 치운 것이 돌아오면
   * 치운 적이 없는 것과 같다.
   */
  const resurrectable = person?.source === 'invite' || Boolean(person?.connectionId);
  return saveGuiyeondoMap({
    ...state,
    people: state.people.filter((item) => item.id !== personId),
    hiddenInvitePersonIds: resurrectable
      ? [...new Set([...(state.hiddenInvitePersonIds || []), personId])].slice(-100)
      : state.hiddenInvitePersonIds || []
  }, ownerId);
}

export function clearGuiyeondoMap(ownerId?: string) {
  window.localStorage.removeItem(mapKey(ownerId));
}

export function addGuiyeondoOwnedInvite(
  state: GuiyeondoMapState,
  invite: GuiyeondoOwnedInvite,
  ownerId?: string
) {
  const invites = [...state.invites.filter((item) => item.publicId !== invite.publicId), invite]
    .filter((item) => Date.parse(item.expiresAt) > Date.now())
    .slice(-5);
  return saveGuiyeondoMap({ ...state, invites }, ownerId);
}

export function removeGuiyeondoOwnedInvite(
  state: GuiyeondoMapState,
  publicId: string,
  ownerId?: string
) {
  return saveGuiyeondoMap({ ...state, invites: state.invites.filter((item) => item.publicId !== publicId) }, ownerId);
}

export function publicInvitePath(publicId: string) {
  if (!/^[a-f0-9]{32}$/i.test(publicId)) throw new Error('유효하지 않은 초대 ID입니다.');
  return `/g/${publicId}`;
}
