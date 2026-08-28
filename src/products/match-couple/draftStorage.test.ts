import { describe, expect, it } from 'vitest';
import {
  MATCH_COUPLE_GUEST_DRAFT_KEY,
  getMatchCoupleDraftKey,
  readMatchCoupleDraft,
  promoteMatchCoupleGuestDraft,
  removeMatchCoupleDraft,
  resolveMatchCoupleDraft,
  saveMatchCoupleDraft
} from './draftStorage';
import type { MatchCoupleStoredFormData } from './types';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    }
  };
}

function draft(name: string): Partial<MatchCoupleStoredFormData> {
  return { name, birthDate: '1992-09-09' };
}

describe('match-couple draft storage', () => {
  it('isolates the guest draft and each signed-in user draft', () => {
    const storage = memoryStorage();

    expect(saveMatchCoupleDraft(draft('게스트'), undefined, storage)).toBe(true);
    expect(saveMatchCoupleDraft(draft('회원 A'), 'user/a', storage)).toBe(true);
    expect(saveMatchCoupleDraft(draft('회원 B'), 'user/b', storage)).toBe(true);

    expect(getMatchCoupleDraftKey()).toBe(MATCH_COUPLE_GUEST_DRAFT_KEY);
    expect(getMatchCoupleDraftKey('user/a')).toContain('user%2Fa');
    expect(readMatchCoupleDraft(undefined, storage)?.name).toBe('게스트');
    expect(readMatchCoupleDraft('user/a', storage)?.name).toBe('회원 A');
    expect(readMatchCoupleDraft('user/b', storage)?.name).toBe('회원 B');
  });

  it('uses valid route state first and refuses route state owned by another user', () => {
    const storage = memoryStorage();
    saveMatchCoupleDraft(draft('게스트'), undefined, storage);
    saveMatchCoupleDraft(draft('현재 회원'), 'current', storage);

    expect(resolveMatchCoupleDraft({
      routeFormData: draft('라우트'),
      routeDraftOwnerId: 'current',
      currentUserId: 'current',
      storage
    })?.name).toBe('라우트');

    expect(resolveMatchCoupleDraft({
      routeFormData: draft('다른 회원'),
      routeDraftOwnerId: 'other',
      currentUserId: 'current',
      storage
    })?.name).toBe('현재 회원');
  });

  it('falls back to the guest draft after login when no user draft exists', () => {
    const storage = memoryStorage();
    saveMatchCoupleDraft(draft('로그인 전 입력'), undefined, storage);

    expect(resolveMatchCoupleDraft({ currentUserId: 'new-user', storage })?.name)
      .toBe('로그인 전 입력');
  });

  it('prefers the just-submitted guest draft on an explicit login return', () => {
    const storage = memoryStorage();
    saveMatchCoupleDraft(draft('방금 입력한 게스트'), undefined, storage);
    saveMatchCoupleDraft(draft('예전 회원 초안'), 'returning-user', storage);

    expect(resolveMatchCoupleDraft({
      currentUserId: 'returning-user',
      preferGuest: true,
      storage
    })?.name).toBe('방금 입력한 게스트');

    expect(promoteMatchCoupleGuestDraft(draft('방금 입력한 게스트'), 'returning-user', storage)).toBe(true);
    expect(readMatchCoupleDraft('returning-user', storage)?.name).toBe('방금 입력한 게스트');
    expect(readMatchCoupleDraft(undefined, storage)).toBeUndefined();
  });

  it('keeps the member draft first on an ordinary signed-in preview visit', () => {
    const storage = memoryStorage();
    saveMatchCoupleDraft(draft('남아 있는 게스트'), undefined, storage);
    saveMatchCoupleDraft(draft('현재 회원 초안'), 'returning-user', storage);

    expect(resolveMatchCoupleDraft({
      currentUserId: 'returning-user',
      storage
    })?.name).toBe('현재 회원 초안');
  });

  it('removes malformed JSON and supports explicit cleanup', () => {
    const storage = memoryStorage();
    storage.setItem(MATCH_COUPLE_GUEST_DRAFT_KEY, '{broken');

    expect(readMatchCoupleDraft(undefined, storage)).toBeUndefined();
    expect(storage.getItem(MATCH_COUPLE_GUEST_DRAFT_KEY)).toBeNull();

    saveMatchCoupleDraft(draft('지울 초안'), 'owner', storage);
    expect(removeMatchCoupleDraft('owner', storage)).toBe(true);
    expect(readMatchCoupleDraft('owner', storage)).toBeUndefined();
  });
});
