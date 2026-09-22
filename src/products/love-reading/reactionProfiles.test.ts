import { describe, expect, it } from 'vitest';
import {
  getLoveReactionProfile,
  LOVE_REACTION_IDS,
  LOVE_REACTION_PROFILES
} from './reactionProfiles';

describe('love-reading reaction profiles', () => {
  it('exposes one canonical profile for every persisted A-D value', () => {
    expect(LOVE_REACTION_PROFILES.map((profile) => profile.id)).toEqual(LOVE_REACTION_IDS);
    expect(new Set(LOVE_REACTION_PROFILES.map((profile) => profile.id)).size).toBe(4);
  });

  it('provides landing copy and a complete report chapter override', () => {
    LOVE_REACTION_PROFILES.forEach((profile) => {
      expect(profile.label.length).toBeGreaterThan(0);
      expect(profile.response.length).toBeGreaterThan(0);
      expect(Object.values(profile.chapterCopy).every((value) => value.length > 0)).toBe(true);
    });
  });

  it('returns only canonical reactions', () => {
    expect(getLoveReactionProfile('C')?.profileTitle).toContain('미러형');
    expect(getLoveReactionProfile('mirror')).toBeNull();
    expect(getLoveReactionProfile(undefined)).toBeNull();
  });
});
