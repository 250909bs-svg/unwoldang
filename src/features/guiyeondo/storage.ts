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

function isUnexpiredInvitePerson(person: GuiyeondoPerson, now = Date.now()) {
  const expiresAt = typeof person.expiresAt === 'string' ? Date.parse(person.expiresAt) : Number.NaN;
  return person.source !== 'invite' || (Number.isFinite(expiresAt) && expiresAt > now);
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
    && /^[a-f0-9]{64}$/i.test(invite.ownerKey || '')
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
    merged.set(person.id, person);
  }
  return saveGuiyeondoMap({ ...state, people: [...merged.values()].slice(-100) }, ownerId);
}

export function removeGuiyeondoPerson(state: GuiyeondoMapState, personId: string, ownerId?: string) {
  const person = state.people.find((item) => item.id === personId);
  return saveGuiyeondoMap({
    ...state,
    people: state.people.filter((item) => item.id !== personId),
    hiddenInvitePersonIds: person?.source === 'invite'
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
