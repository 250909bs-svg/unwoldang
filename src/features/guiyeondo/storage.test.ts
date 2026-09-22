import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { analyzeGuiyeondoRelationship } from './relationshipAnalysis';
import { buildGuiyeondoInviteUrl } from './share';
import {
  addGuiyeondoOwnedInvite,
  addGuiyeondoPerson,
  createGuiyeondoMap,
  createGuiyeondoPreviewOwnerId,
  guiyeondoPreviewOwnerPath,
  mergeGuiyeondoInvitePeople,
  normalizeGuiyeondoPreviewOwnerId,
  publicInvitePath,
  readGuiyeondoMap,
  removeGuiyeondoPerson,
  saveGuiyeondoMap
} from './storage';
import type { GuiyeondoBirthProfile, GuiyeondoOwnedInvite, GuiyeondoPerson } from './types';

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value)
  };
}

const owner: GuiyeondoBirthProfile = {
  name: '초대한 사람',
  gender: 'male',
  calendar: 'solar',
  isLeapMonth: false,
  birthDate: '1992-09-09',
  birthTime: '10:24',
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
};

const ownedInvite: GuiyeondoOwnedInvite = {
  publicId: 'a'.repeat(32),
  ownerKey: 'b'.repeat(64),
  hostName: owner.name,
  createdAt: '2026-09-15T00:00:00.000Z',
  expiresAt: '2099-09-29T00:00:00.000Z',
  sigilSeed: 'opaque-sigil'
};

describe('귀연도 로컬 지도와 초대 개인정보 계약', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: createMemoryStorage(),
        location: { origin: 'https://www.unwoldang.com' }
      }
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'window');
  });

  it('사용자별 지도 저장소를 분리한다', () => {
    saveGuiyeondoMap(createGuiyeondoMap(owner), 'kakao-owner-a');
    expect(readGuiyeondoMap('kakao-owner-a')?.owner.name).toBe('초대한 사람');
    expect(readGuiyeondoMap('kakao-owner-b')).toBeNull();
  });

  it('초대받은 사람의 새 지도 ID를 초대자 저장소와 분리한다', () => {
    const previewOwnerId = createGuiyeondoPreviewOwnerId();
    const path = guiyeondoPreviewOwnerPath(previewOwnerId);
    expect(previewOwnerId).toMatch(/^preview-[a-f0-9]{32}$/i);
    expect(normalizeGuiyeondoPreviewOwnerId(previewOwnerId.toUpperCase())).toBe(previewOwnerId);
    expect(path).toBe(`/guiyeondo?owner=${previewOwnerId}`);
    expect(path).not.toContain(owner.name);
    expect(path).not.toContain(owner.birthDate);
  });

  it('공개 URL에는 무작위 ID 외 출생정보·성별·이름·owner key를 넣지 않는다', () => {
    const path = publicInvitePath(ownedInvite.publicId);
    const url = buildGuiyeondoInviteUrl(ownedInvite.publicId, 'https://www.unwoldang.com');
    expect(path).toBe(`/g/${ownedInvite.publicId}`);
    expect(url).toBe(`https://www.unwoldang.com/g/${ownedInvite.publicId}`);
    for (const privateValue of [owner.name, owner.birthDate, owner.birthTime, owner.gender, ownedInvite.ownerKey]) {
      expect(url).not.toContain(privateValue);
      expect(url).not.toContain(encodeURIComponent(privateValue));
    }
    expect(new URL(url).search).toBe('');
    expect(new URL(url).hash).toBe('');
  });

  it('서버가 발급한 owner capability만 지도에 보관하고 owner profile은 초대에 복제하지 않는다', () => {
    const next = addGuiyeondoOwnedInvite(createGuiyeondoMap(owner), ownedInvite, 'kakao-owner-a');
    expect(next.invites).toEqual([ownedInvite]);
    expect(JSON.stringify(next.invites)).not.toContain(owner.birthDate);
    expect(JSON.stringify(next.invites)).not.toContain('ownerProfile');
    expect(readGuiyeondoMap('kakao-owner-a')?.invites).toEqual([ownedInvite]);
  });

  it('같은 이름과 동일 계산 fingerprint의 반복 직접 등록은 한 사람으로 갱신한다', () => {
    const guestProfile: GuiyeondoBirthProfile = { ...owner, name: '중복 상대', gender: 'female' };
    const analysis = analyzeGuiyeondoRelationship(owner, guestProfile);
    const first = { id: 'first', name: guestProfile.name, source: 'direct', createdAt: '2026-09-15T00:00:00.000Z', privateBirthProfile: guestProfile, analysis } satisfies GuiyeondoPerson;
    const second = { ...first, id: 'second', createdAt: '2026-09-15T00:01:00.000Z' } satisfies GuiyeondoPerson;
    const twice = addGuiyeondoPerson(addGuiyeondoPerson(createGuiyeondoMap(owner), first, 'owner'), second, 'owner');
    expect(twice.people.map((item) => item.id)).toEqual(['second']);
    expect(twice.people[0]?.privateBirthProfile).toBeUndefined();
  });

  it('서버의 초대 응답만 지도에 합치고 원본 프로필이 포함된 응답은 거부한다', () => {
    const guestProfile: GuiyeondoBirthProfile = { ...owner, name: '초대받은 사람', gender: 'female', birthDate: '2000-01-01' };
    const cleanPerson = { id: 'guest-1', name: guestProfile.name, source: 'invite', createdAt: '2026-09-15T00:00:00.000Z', expiresAt: '2099-09-29T00:00:00.000Z', analysis: analyzeGuiyeondoRelationship(owner, guestProfile) } satisfies GuiyeondoPerson;
    const dirtyPerson = { ...cleanPerson, id: 'guest-2', privateBirthProfile: guestProfile } satisfies GuiyeondoPerson;
    const merged = mergeGuiyeondoInvitePeople(createGuiyeondoMap(owner), [cleanPerson, dirtyPerson], 'owner');
    expect(merged.people.map((item) => item.id)).toEqual(['guest-1']);
    expect(merged.people[0]?.privateBirthProfile).toBeUndefined();
  });

  it('만료된 초대 응답과 초대 관리 키를 읽기 및 동기화 시 제거한다', () => {
    const guestProfile: GuiyeondoBirthProfile = { ...owner, name: '만료 상대', gender: 'female', birthDate: '2000-01-01' };
    const expiredPerson = { id: 'expired', name: guestProfile.name, source: 'invite', createdAt: '2026-09-01T00:00:00.000Z', expiresAt: '2026-09-02T00:00:00.000Z', analysis: analyzeGuiyeondoRelationship(owner, guestProfile) } satisfies GuiyeondoPerson;
    const directPerson = { ...expiredPerson, id: 'direct', source: 'direct' as const, expiresAt: undefined } satisfies GuiyeondoPerson;
    const expiredInvite = { ...ownedInvite, expiresAt: '2026-09-02T00:00:00.000Z' };
    const state = { ...createGuiyeondoMap(owner), people: [expiredPerson, directPerson], invites: [expiredInvite] };
    saveGuiyeondoMap(state, 'owner');

    expect(readGuiyeondoMap('owner')?.people.map((item) => item.id)).toEqual(['direct']);
    expect(readGuiyeondoMap('owner')?.invites).toEqual([]);
    const persisted = window.localStorage.getItem('unwoldang.guiyeondo.preview.v1.owner') || '';
    expect(persisted).not.toContain('expired');
    expect(persisted).not.toContain(expiredInvite.publicId);
    expect(mergeGuiyeondoInvitePeople(state, [], 'owner').people.map((item) => item.id)).toEqual(['direct']);
  });

  it('계정에 남은 초대 응답은 만료 없이 지도에 남는다', () => {
    /*
     * 예전에는 초대로 들어온 사람이면 무조건 `expiresAt` 을 검사해서 지웠다. 그래서
     * 브라우저를 그대로 둬도 14일이면 인연이 지도에서 빠졌다 — 초대 링크의 수명이 곧
     * 인연의 수명이었던 셈이다. 이제 만료 시각이 **붙어 있는 사람만** 만료된다.
     */
    const guestProfile: GuiyeondoBirthProfile = { ...owner, name: '계정 인연', gender: 'female', birthDate: '2000-01-01' };
    const kept = {
      id: 'kept',
      name: guestProfile.name,
      source: 'invite',
      createdAt: '2026-09-01T00:00:00.000Z',
      connectionId: 'a'.repeat(64),
      analysis: analyzeGuiyeondoRelationship(owner, guestProfile)
    } satisfies GuiyeondoPerson;
    saveGuiyeondoMap({ ...createGuiyeondoMap(owner), people: [kept] }, 'owner');

    expect(readGuiyeondoMap('owner')?.people.map((item) => item.id)).toEqual(['kept']);
  });

  it('응답 목록이 나중에 도착해도 계정에 남은 사람에게 만료를 도로 붙이지 않는다', () => {
    /*
     * 같은 사람이 두 경로로 들어온다. 인연 목록은 만료 없이, 초대 응답 목록은 초대의
     * 만료 시각을 달고 온다. 응답 목록이 나중에 도착했다고 만료를 붙이면 14일 뒤
     * 사라지던 옛 동작으로 조용히 되돌아간다.
     */
    const guestProfile: GuiyeondoBirthProfile = { ...owner, name: '두 경로', gender: 'female', birthDate: '2000-01-01' };
    const analysis = analyzeGuiyeondoRelationship(owner, guestProfile);
    const fromConnection = {
      id: 'both',
      name: guestProfile.name,
      source: 'invite',
      createdAt: '2026-09-01T00:00:00.000Z',
      connectionId: 'b'.repeat(64),
      analysis
    } satisfies GuiyeondoPerson;
    const fromResponses = {
      id: 'both',
      name: guestProfile.name,
      source: 'invite',
      createdAt: '2026-09-01T00:00:00.000Z',
      expiresAt: '2099-09-29T00:00:00.000Z',
      analysis
    } satisfies GuiyeondoPerson;

    const state = { ...createGuiyeondoMap(owner), people: [fromConnection] };
    const merged = mergeGuiyeondoInvitePeople(state, [fromResponses], 'owner');

    expect(merged.people).toHaveLength(1);
    expect(merged.people[0].expiresAt).toBeUndefined();
    expect(merged.people[0].connectionId).toBe('b'.repeat(64));
  });

  it('계정에 남은 사람을 지우면 동기화가 되살리지 못하게 표시해 둔다', () => {
    /* 서버 삭제가 늦거나 실패해도 다음 동기화가 그 사람을 다시 얹으면 안 된다. */
    const guestProfile: GuiyeondoBirthProfile = { ...owner, name: '지운 사람', gender: 'female', birthDate: '2000-01-01' };
    const direct = {
      id: 'direct-synced',
      name: guestProfile.name,
      source: 'direct',
      createdAt: '2026-09-01T00:00:00.000Z',
      connectionId: 'e'.repeat(64),
      analysis: analyzeGuiyeondoRelationship(owner, guestProfile)
    } satisfies GuiyeondoPerson;
    const state = saveGuiyeondoMap({ ...createGuiyeondoMap(owner), people: [direct] }, 'owner');

    const removed = removeGuiyeondoPerson(state, 'direct-synced', 'owner');
    expect(removed.people).toEqual([]);
    expect(removed.hiddenInvitePersonIds).toContain('direct-synced');
  });

  it('사용자가 지운 원격 응답은 다음 동기화에서 다시 나타나지 않는다', () => {
    const guestProfile: GuiyeondoBirthProfile = { ...owner, name: '숨긴 상대', gender: 'female', birthDate: '2000-01-01' };
    const person = { id: 'c'.repeat(64), name: guestProfile.name, source: 'invite', createdAt: '2026-09-15T00:00:00.000Z', expiresAt: '2099-09-29T00:00:00.000Z', analysis: analyzeGuiyeondoRelationship(owner, guestProfile) } satisfies GuiyeondoPerson;
    const merged = mergeGuiyeondoInvitePeople(createGuiyeondoMap(owner), [person], 'owner');
    const removed = removeGuiyeondoPerson(merged, person.id, 'owner');
    const syncedAgain = mergeGuiyeondoInvitePeople(removed, [person], 'owner');

    expect(removed.hiddenInvitePersonIds).toEqual([person.id]);
    expect(syncedAgain.people).toEqual([]);
  });

  it('사용자가 선택한 인연만 삭제하고 나머지 지도는 보존한다', () => {
    const guestProfile: GuiyeondoBirthProfile = { ...owner, name: '삭제 상대', gender: 'female' };
    const person = { id: 'remove-me', name: guestProfile.name, source: 'direct', createdAt: '2026-09-15T00:00:00.000Z', analysis: analyzeGuiyeondoRelationship(owner, guestProfile) } satisfies GuiyeondoPerson;
    const state = addGuiyeondoPerson(createGuiyeondoMap(owner), person, 'owner');
    expect(removeGuiyeondoPerson(state, person.id, 'owner').people).toEqual([]);
  });

  it('변조된 public ID를 거부한다', () => {
    expect(() => publicInvitePath('../private')).toThrow('유효하지 않은 초대 ID');
  });
});
