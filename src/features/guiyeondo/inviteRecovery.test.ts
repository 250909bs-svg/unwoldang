import { describe, expect, it } from 'vitest';
import {
  GUIYEONDO_MAX_TRACKED_INVITES,
  liveGuiyeondoInvites,
  mergeGuiyeondoOwnedInvites,
  sameGuiyeondoInviteSet,
  withRecoveredInvites
} from './inviteRecovery';
import { createGuiyeondoMap } from './storage';
import type { GuiyeondoBirthProfile, GuiyeondoOwnedInvite } from './types';

const NOW = Date.parse('2026-09-22T00:00:00.000Z');

const invite = (publicId: string, expiresInDays: number): GuiyeondoOwnedInvite => ({
  publicId,
  hostName: '운월',
  sigilSeed: publicId,
  expiresAt: new Date(NOW + expiresInDays * 86_400_000).toISOString(),
  createdAt: new Date(NOW - 86_400_000).toISOString()
});

const owner: GuiyeondoBirthProfile = {
  name: '운월',
  gender: 'female',
  calendar: 'solar',
  isLeapMonth: false,
  birthDate: '1996-03-04',
  birthTime: '09:20',
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

describe('귀연도 초대 복구', () => {
  it('만료된 초대는 되살리지 않는다', () => {
    const live = liveGuiyeondoInvites([invite('expired', -1), invite('alive', 5)], NOW);

    expect(live.map((item) => item.publicId)).toEqual(['alive']);
  });

  it('만료 시각이 깨진 초대도 버린다', () => {
    const broken = { ...invite('broken', 5), expiresAt: 'not-a-date' };

    expect(liveGuiyeondoInvites([broken], NOW)).toEqual([]);
  });

  it('추적 상한을 넘으면 최근 것을 남긴다', () => {
    const many = Array.from({ length: GUIYEONDO_MAX_TRACKED_INVITES + 3 }, (_, index) =>
      invite(`invite-${index}`, 5)
    );

    const live = liveGuiyeondoInvites(many, NOW);

    expect(live).toHaveLength(GUIYEONDO_MAX_TRACKED_INVITES);
    expect(live.at(-1)?.publicId).toBe(`invite-${GUIYEONDO_MAX_TRACKED_INVITES + 2}`);
  });

  it('같은 초대는 서버 값이 이기고, 로컬에만 있는 초대는 살아남는다', () => {
    const local = [{ ...invite('shared', 1), hostName: '옛이름' }, invite('local-only', 3)];
    const remote = [invite('shared', 9)];

    const merged = mergeGuiyeondoOwnedInvites(local, remote, NOW);

    // 서버가 만료를 늘려 준 값이 반영된다.
    expect(merged.find((item) => item.publicId === 'shared')?.expiresAt).toBe(invite('shared', 9).expiresAt);
    expect(merged.find((item) => item.publicId === 'shared')?.hostName).toBe('운월');
    // 방금 만들어 서버 목록에 아직 안 잡힌 초대를 버리면 링크가 죽는다.
    expect(merged.map((item) => item.publicId)).toContain('local-only');
  });

  it('지도가 없던 브라우저에서도 초대 목록만으로 복구가 된다', () => {
    const merged = mergeGuiyeondoOwnedInvites([], [invite('a', 4), invite('b', 6)], NOW);

    expect(merged.map((item) => item.publicId)).toEqual(['a', 'b']);
  });

  it('만료 시각이 갱신되면 같은 목록으로 보지 않는다', () => {
    const before = [invite('a', 3)];

    expect(sameGuiyeondoInviteSet(before, [invite('a', 3)])).toBe(true);
    expect(sameGuiyeondoInviteSet(before, [invite('a', 9)])).toBe(false);
    expect(sameGuiyeondoInviteSet(before, [])).toBe(false);
  });

  it('새 지도에 되살린 초대를 얹는다 — 그러면 기존 동기화가 응답을 끌어온다', () => {
    const fresh = createGuiyeondoMap(owner);
    expect(fresh.invites).toEqual([]);

    const restored = withRecoveredInvites(fresh, [invite('a', 4)], NOW);

    expect(restored.invites.map((item) => item.publicId)).toEqual(['a']);
    expect(restored.owner).toBe(owner);
    expect(restored.people).toEqual([]);
  });

  it('되살릴 것이 없으면 지도 객체를 그대로 돌려준다', () => {
    const fresh = createGuiyeondoMap(owner);

    // 같은 참조여야 한다. 새 객체를 만들면 setState 가 불필요하게 다시 돈다.
    expect(withRecoveredInvites(fresh, [], NOW)).toBe(fresh);
    expect(withRecoveredInvites(fresh, undefined, NOW)).toBe(fresh);
    expect(withRecoveredInvites(fresh, [invite('expired', -2)], NOW)).toBe(fresh);
  });
});
