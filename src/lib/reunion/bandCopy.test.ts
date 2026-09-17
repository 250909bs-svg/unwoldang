import { describe, expect, it } from 'vitest';
import { REUNION_AGE_BANDS } from './ageBand';
import {
  REUNION_BAND_COPY,
  REUNION_HYPOTHESIS_BANDS,
  REUNION_PARTNER_TERM,
  applyBandLexicon,
  getBandExpansionBlocks,
  getReunionBandProfile,
  isChapterExpandedByDefault
} from './bandCopy';
import { findReunionBannedPhrases } from './bannedPhrases';

describe('reunion band copy table', () => {
  it('covers every band with a complete profile', () => {
    REUNION_AGE_BANDS.forEach((band) => {
      const profile = REUNION_BAND_COPY[band];
      expect(profile, band).toBeDefined();
      expect(profile.lexicon.channel).toBeTruthy();
      expect(profile.lexicon.silence).toBeTruthy();
      expect(profile.lexicon.interval).toBeTruthy();
      expect(profile.expandedChapters).toHaveLength(2);
      expect(['observed', 'hypothesis']).toContain(profile.evidence);
    });
  });

  it('calls the other person the same thing in every band', () => {
    REUNION_AGE_BANDS.forEach((band) => {
      expect(REUNION_BAND_COPY[band].lexicon.partner, band).toBe(REUNION_PARTNER_TERM);
    });
    expect(REUNION_PARTNER_TERM).toBe('그 사람');
  });

  it('never reintroduces the discreet-exit block that section 6-B removed', () => {
    const blocks = REUNION_AGE_BANDS.flatMap((band) =>
      REUNION_BAND_COPY[band].expansions.map((item) => item.blockId)
    );
    expect(blocks).not.toContain('discreet-exit');
    expect(REUNION_BAND_COPY.teen.expansions).toHaveLength(0);
  });

  it('marks the two bands with no observed speech as hypotheses', () => {
    expect([...REUNION_HYPOTHESIS_BANDS].sort()).toEqual(['fiftyPlus', 'teen']);
  });

  it('keeps neutral as a safe landing: no expansions, no extra bans', () => {
    expect(REUNION_BAND_COPY.neutral.expansions).toHaveLength(0);
    expect(REUNION_BAND_COPY.neutral.banned).toHaveLength(0);
    expect(REUNION_BAND_COPY.neutral.expandedChapters).toEqual([3, 2]);
  });

  it('looks up expansion blocks and default-open chapters by band', () => {
    expect(getBandExpansionBlocks('late20s', 1)).toEqual(['pride-motive']);
    expect(getBandExpansionBlocks('late20s', 3)).toEqual(['after-settling']);
    expect(getBandExpansionBlocks('neutral', 1)).toEqual([]);
    expect(isChapterExpandedByDefault('forties', 5)).toBe(true);
    expect(isChapterExpandedByDefault('forties', 1)).toBe(false);
  });

  it('falls back to the neutral profile for an unknown band', () => {
    expect(getReunionBandProfile('nope' as never)).toBe(REUNION_BAND_COPY.neutral);
  });

  it('substitutes lexicon slots and leaves unknown slots visible for tests to catch', () => {
    expect(applyBandLexicon('{partner}에게 {channel}을 보냅니다', 'teen', '지윤')).toBe(
      '그 사람에게 메시지을 보냅니다'
    );
    expect(applyBandLexicon('{name}님, {interval}이요', 'thirties', '지윤')).toBe('지윤님, 몇 달이요');
    expect(applyBandLexicon('{unknownSlot}', 'neutral', '지윤')).toBe('{unknownSlot}');
  });

  it('never contains a banned phrase inside its own lexicon', () => {
    REUNION_AGE_BANDS.forEach((band) => {
      const lexicon = Object.values(REUNION_BAND_COPY[band].lexicon).join(' ');
      expect(findReunionBannedPhrases(lexicon, band), band).toEqual([]);
    });
  });
});
