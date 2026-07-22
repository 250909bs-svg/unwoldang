export type PastLifePausableMedia = {
  pause: () => void;
};

export type PastLifeAutoplayContext = {
  prefersReducedMotion: boolean;
  hasFailed: boolean;
  manuallyPaused: boolean;
  visibilityState: DocumentVisibilityState;
};

export function shouldPresentPastLifePoster(prefersReducedMotion: boolean, hasFailed: boolean) {
  return prefersReducedMotion || hasFailed;
}

export function canAutoplayPastLifeVideo(context: PastLifeAutoplayContext) {
  return (
    !context.prefersReducedMotion &&
    !context.hasFailed &&
    !context.manuallyPaused &&
    context.visibilityState === 'visible'
  );
}

export function pausePastLifeVideos(media: readonly (PastLifePausableMedia | null | undefined)[]) {
  media.forEach((item) => item?.pause());
}
