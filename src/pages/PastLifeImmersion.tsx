import { ArrowLeft, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PAST_LIFE_PRODUCT } from '../content/pastLifeExperience';
import '../styles/past-life.css';

const nextStoryState = { tabOrigin: '/' } as const;
const CROSSFADE_SECONDS = 0.75;
const CROSSFADE_MS = 620;
const getInitialReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function PastLifeImmersion() {
  const navigate = useNavigate();
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const activeIndexRef = useRef(0);
  const isMutedRef = useRef(true);
  const hasEnteredRef = useRef(false);
  const hasPresentedChoiceRef = useRef(getInitialReducedMotion());
  const transitionLockRef = useRef(false);
  const transitionTimersRef = useRef<number[]>([]);
  const failedClipsRef = useRef(new Set<number>());
  const [isMuted, setIsMuted] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showChoices, setShowChoices] = useState(getInitialReducedMotion);
  const [hasFailed, setHasFailed] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(getInitialReducedMotion);
  const [isFirstClipReady, setIsFirstClipReady] = useState(false);
  const [hasFirstClipStarted, setHasFirstClipStarted] = useState(false);
  const [canSkipLoading, setCanSkipLoading] = useState(false);
  const films = PAST_LIFE_PRODUCT.immersionFilms;

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncPreference = () => {
      setPrefersReducedMotion(media.matches);
      setIsFirstClipReady(false);
      if (media.matches) {
        hasPresentedChoiceRef.current = true;
        setHasFirstClipStarted(false);
        setShowChoices(true);
      } else {
        setHasFirstClipStarted(hasEnteredRef.current || hasPresentedChoiceRef.current);
      }
      if (!media.matches && !hasEnteredRef.current && !hasPresentedChoiceRef.current) {
        setShowChoices(false);
      }
    };

    media.addEventListener('change', syncPreference);
    return () => media.removeEventListener('change', syncPreference);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || hasFailed || hasFirstClipStarted) {
      setCanSkipLoading(false);
      return;
    }

    const timer = window.setTimeout(() => setCanSkipLoading(true), 8000);
    return () => window.clearTimeout(timer);
  }, [hasFailed, hasFirstClipStarted, prefersReducedMotion]);

  useEffect(() => {
    return () => {
      transitionTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      videoRefs.current.forEach((video) => video?.pause());
    };
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || hasFailed) {
      return;
    }

    [activeIndex, activeIndex + 1].forEach((index) => {
      const video = videoRefs.current[index];
      if (!video) {
        return;
      }

      video.preload = 'auto';
      video.muted = isMutedRef.current;
      if (video.readyState === 0) {
        video.load();
      }
    });
  }, [activeIndex, hasFailed, prefersReducedMotion]);

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

  const goToIntake = () => {
    navigate('/form/past-life-goblin', { state: nextStoryState });
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
      if (hasEnteredRef.current) {
        goToIntake();
      } else {
        setShowChoices(true);
      }
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
    const revealLead = Math.min(1.5, Math.max(1.1, video.duration * 0.3));

    if (index === 0 && !hasEnteredRef.current) {
      if (remaining <= revealLead) {
        hasPresentedChoiceRef.current = true;
        setShowChoices(true);
      }
      return;
    }

    if (!isLastClip && remaining <= CROSSFADE_SECONDS) {
      startNextClip(index);
    }
  };

  const enterStory = () => {
    if (hasFailed || prefersReducedMotion) {
      goToIntake();
      return;
    }

    hasEnteredRef.current = true;
    setShowChoices(false);
    startNextClip(0);
  };

  const handleClipError = (index: number) => {
    failedClipsRef.current.add(index);
    if (index === 0) {
      setIsFirstClipReady(false);
      setHasFirstClipStarted(false);
    }
    if (index !== activeIndexRef.current) {
      return;
    }

    transitionLockRef.current = false;
    if (hasEnteredRef.current && index < films.length - 1) {
      startNextClip(index);
      return;
    }

    if (hasEnteredRef.current) {
      goToIntake();
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

  const handleClipReady = (index: number, video: HTMLVideoElement) => {
    if (index === 0) {
      setIsFirstClipReady(true);
    }

    if (index !== activeIndexRef.current || !video.paused || prefersReducedMotion) {
      return;
    }

    video.muted = isMutedRef.current;
    void video.play().catch(() => undefined);
  };

  const resumeFirstClip = () => {
    const video = videoRefs.current[0];
    if (!video || hasFailed || prefersReducedMotion) {
      return;
    }

    video.muted = isMutedRef.current;
    void video.play().catch(() => undefined);
  };

  const handleLoadingAction = () => {
    if (canSkipLoading) {
      goToIntake();
      return;
    }

    resumeFirstClip();
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
              className={`dokkaebi-immersion-media ${activeIndex === index ? 'is-active' : ''}`}
              muted
              autoPlay={index === 0}
              playsInline
              preload={index === activeIndex || index === activeIndex + 1 ? 'auto' : 'none'}
              aria-label={`전생 이야기 ${index + 1}장`}
              onLoadedData={(event) => handleClipReady(index, event.currentTarget)}
              onCanPlay={(event) => handleClipReady(index, event.currentTarget)}
              onPlaying={() => {
                if (index === 0) {
                  setIsFirstClipReady(true);
                  setHasFirstClipStarted(true);
                }
              }}
              onTimeUpdate={() => handleTimeUpdate(index)}
              onStalled={() => {
                if (index === 0) {
                  setCanSkipLoading(true);
                }
              }}
              onEnded={() => {
                if (index === 0 && !hasEnteredRef.current) {
                  hasPresentedChoiceRef.current = true;
                  setShowChoices(true);
                } else if (index === films.length - 1) {
                  goToIntake();
                } else {
                  startNextClip(index);
                }
              }}
              onError={() => handleClipError(index)}
            />
          ))
        )}

        {!showPoster && !hasFirstClipStarted ? (
          <button
            type="button"
            className="dokkaebi-cinematic-loading dokkaebi-immersion-loading"
            onClick={handleLoadingAction}
            disabled={!isFirstClipReady && !canSkipLoading}
            aria-label={
              canSkipLoading
                ? '영상 없이 사주정보 입력으로 계속하기'
                : isFirstClipReady
                  ? '도깨비 전생 이야기 재생하기'
                  : '도깨비 전생 이야기 불러오는 중'
            }
          >
            <span className="dokkaebi-cinematic-loading-seal" aria-hidden="true" />
            <strong>
              {canSkipLoading
                ? '기다리지 않아도 돼'
                : isFirstClipReady
                  ? '네가 허락하면 첫 장을 열게'
                  : '기록을 깨우는 중이야'}
            </strong>
            <small>
              {canSkipLoading
                ? '누르면 네 이야기부터 들려줘'
                : isFirstClipReady
                  ? '화면을 누르면 시작할게'
                  : '잠시만 기다려'}
            </small>
          </button>
        ) : null}

        <span className="dokkaebi-immersion-vignette" aria-hidden="true" />
        <span className="dokkaebi-immersion-grain" aria-hidden="true" />

        <div
          className={`dokkaebi-immersion-choices ${showChoices ? 'is-visible' : ''}`}
          aria-hidden={!showChoices}
        >
          <button
            type="button"
            className="dokkaebi-immersion-enter"
            onClick={enterStory}
            tabIndex={showChoices ? undefined : -1}
          >
            끝까지 읽어본다
          </button>
          <Link
            to="/form/past-life-goblin"
            state={nextStoryState}
            className="dokkaebi-immersion-skip"
            tabIndex={showChoices ? undefined : -1}
          >
            영상은 건너뛰고 입력한다
          </Link>
        </div>

        {hasFailed ? <p className="dokkaebi-immersion-notice">영상을 불러오지 못해 다음 이야기로 이동할 수 있습니다.</p> : null}
        {prefersReducedMotion ? <p className="dokkaebi-immersion-notice">움직임 감소 설정에 따라 정지 화면으로 표시됩니다.</p> : null}
      </figure>
    </main>
  );
}
