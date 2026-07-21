import { describe, expect, it, vi } from 'vitest';
import {
  canAutoplayPastLifeVideo,
  pausePastLifeVideos,
  shouldPresentPastLifePoster
} from './mediaPolicy';

describe('past-life media policy', () => {
  it('uses a static poster for reduced motion or media failure', () => {
    expect(shouldPresentPastLifePoster(true, false)).toBe(true);
    expect(shouldPresentPastLifePoster(false, true)).toBe(true);
    expect(shouldPresentPastLifePoster(false, false)).toBe(false);
  });

  it('never auto-resumes while hidden, manually paused, failed, or reduced', () => {
    const visible = {
      prefersReducedMotion: false,
      hasFailed: false,
      manuallyPaused: false,
      visibilityState: 'visible' as const
    };

    expect(canAutoplayPastLifeVideo(visible)).toBe(true);
    expect(canAutoplayPastLifeVideo({ ...visible, visibilityState: 'hidden' })).toBe(false);
    expect(canAutoplayPastLifeVideo({ ...visible, manuallyPaused: true })).toBe(false);
    expect(canAutoplayPastLifeVideo({ ...visible, hasFailed: true })).toBe(false);
    expect(canAutoplayPastLifeVideo({ ...visible, prefersReducedMotion: true })).toBe(false);
  });

  it('pauses every mounted clip when the experience stops', () => {
    const firstPause = vi.fn();
    const secondPause = vi.fn();

    pausePastLifeVideos([{ pause: firstPause }, null, { pause: secondPause }]);

    expect(firstPause).toHaveBeenCalledOnce();
    expect(secondPause).toHaveBeenCalledOnce();
  });
});
