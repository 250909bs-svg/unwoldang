import { ArrowLeft, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PAST_LIFE_PRODUCT } from '../content/pastLifeExperience';

const nextStoryState = { tabOrigin: '/' } as const;
const CROSSFADE_SECONDS = 0.75;
const CROSSFADE_MS = 620;

export default function PastLifeImmersion() {
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const activeIndexRef = useRef(0);
  const isMutedRef = useRef(true);
  const transitionLockRef = useRef(false);
  const transitionTimersRef = useRef<number[]>([]);
  const failedClipsRef = useRef(new Set<number>());
  const [isMuted, setIsMuted] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showChoices, setShowChoices] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const films = PAST_LIFE_PRODUCT.immersionFilms;

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncPreference = () => {
      setPrefersReducedMotion(media.matches);
      if (media.matches) {
        setShowChoices(true);
      }
    };

    syncPreference();
    media.addEventListener('change', syncPreference);
    return () => media.removeEventListener('change', syncPreference);
  }, []);

  useEffect(() => {
    return () => {
      transitionTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      videoRefs.current.forEach((video) => video?.pause());
    };
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }

    const resumeActiveClip = () => {
      const activeVideo = videoRefs.current[activeIndexRef.current];
      if (!activeVideo || !activeVideo.paused || activeVideo.ended) {
        return;
      }

      activeVideo.muted = isMutedRef.current;
      void activeVideo.play().catch(() => undefined);
    };

    const timer = window.setTimeout(resumeActiveClip, 0);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        resumeActiveClip();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pageshow', resumeActiveClip);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pageshow', resumeActiveClip);
    };
  }, [prefersReducedMotion]);

  const activateClip = (index: number) => {
    activeIndexRef.current = index;
    setActiveIndex(index);
  };

  const startNextClip = (fromIndex: number) => {
    if (fromIndex !== activeIndexRef.current || transitionLockRef.current) {
      return;
    }

    let nextIndex = fromIndex + 1;
    while (nextIndex < films.length && failedClipsRef.current.has(nextIndex)) {
      nextIndex += 1;
    }

    if (nextIndex >= films.length) {
      setShowChoices(true);
      return;
    }

    const currentVideo = videoRefs.current[fromIndex];
    const nextVideo = videoRefs.current[nextIndex];
    if (!nextVideo) {
      return;
    }

    transitionLockRef.current = true;
    nextVideo.currentTime = 0;
    nextVideo.muted = isMutedRef.current;

    void nextVideo.play().then(() => {
      activateClip(nextIndex);
      const timer = window.setTimeout(() => {
        currentVideo?.pause();
        transitionLockRef.current = false;
      }, CROSSFADE_MS);
      transitionTimersRef.current.push(timer);
    }).catch(() => {
      failedClipsRef.current.add(nextIndex);
      transitionLockRef.current = false;
      startNextClip(fromIndex);
    });
  };

  const handleTimeUpdate = (index: number) => {
    const video = videoRefs.current[index];

    if (!video || index !== activeIndexRef.current || !Number.isFinite(video.duration)) {
      return;
    }

    const remaining = video.duration - video.currentTime;
    const isLastClip = index === films.length - 1;

    if (!isLastClip && remaining <= CROSSFADE_SECONDS) {
      startNextClip(index);
      return;
    }

    const revealLead = Math.min(1.5, Math.max(1.1, video.duration * 0.3));
    if (isLastClip && remaining <= revealLead) {
      setShowChoices(true);
    }
  };

  const handleClipError = (index: number) => {
    failedClipsRef.current.add(index);
    if (index !== activeIndexRef.current) {
      return;
    }

    if (index < films.length - 1) {
      startNextClip(index);
      return;
    }

    setHasFailed(true);
    setShowChoices(true);
  };

  const toggleSound = () => {
    const video = videoRefs.current[activeIndexRef.current];

    if (!video || hasFailed || prefersReducedMotion) {
      return;
    }

    const nextMuted = !isMutedRef.current;
    isMutedRef.current = nextMuted;
    setIsMuted(nextMuted);
    videoRefs.current.forEach((clip) => {
      if (clip) {
        clip.muted = nextMuted;
      }
    });
    if (video.paused && video.currentTime < video.duration) {
      void video.play().catch(() => undefined);
    }
  };

  const showPoster = hasFailed || prefersReducedMotion;

  return (
    <main className="dokkaebi-immersion-page" aria-label="도깨비 전생사주 몰입 이야기">
      <header className="dokkaebi-immersion-head">
        <Link to="/detail/past-life-goblin" className="dokkaebi-immersion-back" aria-label="이전 화면으로 돌아가기">
          <ArrowLeft size={22} aria-hidden="true" />
        </Link>
        <button
          type="button"
          className="dokkaebi-immersion-sound"
          onClick={toggleSound}
          disabled={showPoster}
          aria-label={isMuted ? '영상 소리 켜기' : '영상 소리 끄기'}
          title={isMuted ? '영상 소리 켜기' : '영상 소리 끄기'}
        >
          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </header>

      <figure className="dokkaebi-immersion-stage">
        {showPoster ? (
          <img
            src={PAST_LIFE_PRODUCT.poster}
            alt="도깨비 전생사주 몰입 이야기 포스터"
            className="dokkaebi-immersion-media is-active"
          />
        ) : (
          films.map((src, index) => (
            <video
              key={src}
              ref={(video) => {
                videoRefs.current[index] = video;
              }}
              src={src}
              poster={index === 0 ? PAST_LIFE_PRODUCT.poster : undefined}
              className={`dokkaebi-immersion-media ${activeIndex === index ? 'is-active' : ''}`}
              muted
              autoPlay={index === 0}
              playsInline
              preload="auto"
              aria-label={`전생 이야기 ${index + 1}장`}
              onLoadedData={(event) => {
                if (index === activeIndexRef.current && event.currentTarget.paused && !prefersReducedMotion) {
                  event.currentTarget.muted = isMutedRef.current;
                  void event.currentTarget.play().catch(() => undefined);
                }
              }}
              onTimeUpdate={() => handleTimeUpdate(index)}
              onEnded={() => {
                if (index === films.length - 1) {
                  setShowChoices(true);
                } else {
                  startNextClip(index);
                }
              }}
              onError={() => handleClipError(index)}
            />
          ))
        )}

        <span className="dokkaebi-immersion-vignette" aria-hidden="true" />
        <span className="dokkaebi-immersion-grain" aria-hidden="true" />

        <div
          className={`dokkaebi-immersion-choices ${showChoices ? 'is-visible' : ''}`}
          aria-hidden={!showChoices}
        >
          <Link
            to="/form/past-life-goblin"
            state={nextStoryState}
            className="dokkaebi-immersion-enter"
            tabIndex={showChoices ? undefined : -1}
          >
            무섭지만... 들어간다
          </Link>
          <Link
            to="/form/past-life-goblin"
            state={nextStoryState}
            className="dokkaebi-immersion-skip"
            tabIndex={showChoices ? undefined : -1}
          >
            스킵한다
          </Link>
        </div>

        {hasFailed ? <p className="dokkaebi-immersion-notice">영상을 불러오지 못해 다음 이야기로 이동할 수 있습니다.</p> : null}
        {prefersReducedMotion ? <p className="dokkaebi-immersion-notice">움직임 감소 설정에 따라 정지 화면으로 표시됩니다.</p> : null}
      </figure>
    </main>
  );
}
