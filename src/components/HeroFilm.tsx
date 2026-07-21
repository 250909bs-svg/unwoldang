import { Hand, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  canAutoplayPastLifeVideo,
  pausePastLifeVideos,
  shouldPresentPastLifePoster
} from '../products/past-life-goblin/mediaPolicy';

type HeroFilmProps = {
  src: string;
  poster: string;
  title: string;
  actionHref: string;
  actionLabel: string;
  actionState?: { tabOrigin: string };
  variant?: 'embedded' | 'entry';
};

const filmCaptions = [
  { until: 1.5, text: '사주에 남은 오래된 흔적' },
  { until: 3.8, text: '전생에 당신은 누구였나' },
  { until: 6, text: '누구를 사랑했고' },
  { until: 8.2, text: '무엇을 끝내지 못했나' },
  { until: 10.5, text: '왜 지금도 같은 장면이 반복되는가' },
  { until: 12.2, text: '도깨비 전생장부: 봉인록' },
  { until: Number.POSITIVE_INFINITY, text: '개인 맞춤 전생장부 · 49,000원' }
] as const;

const previewMoments = [
  '진짜 제 이야기 같아서 소름 돋았어요',
  '반복하던 관계의 이유가 바로 보였어요',
  '마지막 편지는 자꾸 다시 보게 돼요'
] as const;

export default function HeroFilm({
  src,
  poster,
  title,
  actionHref,
  actionLabel,
  actionState,
  variant = 'embedded'
}: HeroFilmProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const manuallyPausedRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [hasFailed, setHasFailed] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [hasPlaybackStarted, setHasPlaybackStarted] = useState(false);
  const [captionIndex, setCaptionIndex] = useState(0);
  const [previewIndex, setPreviewIndex] = useState(0);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncPreference = () => {
      setIsVideoReady(false);
      setHasPlaybackStarted(false);
      setPrefersReducedMotion(media.matches);
    };

    media.addEventListener('change', syncPreference);
    return () => media.removeEventListener('change', syncPreference);
  }, []);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || prefersReducedMotion || hasFailed) {
      pausePastLifeVideos([video]);
      return;
    }

    let isInView = false;
    const syncPlayback = () => {
      if (
        isInView &&
        canAutoplayPastLifeVideo({
          prefersReducedMotion,
          hasFailed,
          manuallyPaused: manuallyPausedRef.current,
          visibilityState: document.visibilityState
        })
      ) {
        void video.play().catch(() => undefined);
        return;
      }

      pausePastLifeVideos([video]);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        isInView = entry.isIntersecting && entry.intersectionRatio >= 0.45;
        syncPlayback();
      },
      { threshold: [0, 0.45, 0.75] }
    );

    const handlePageHide = () => pausePastLifeVideos([video]);
    observer.observe(video);
    document.addEventListener('visibilitychange', syncPlayback);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', syncPlayback);
      window.removeEventListener('pagehide', handlePageHide);
      pausePastLifeVideos([video]);
    };
  }, [hasFailed, prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion) {
      setPreviewIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setPreviewIndex((current) => (current + 1) % previewMoments.length);
    }, 5200);

    return () => window.clearInterval(timer);
  }, [prefersReducedMotion]);

  const togglePlayback = () => {
    const video = videoRef.current;

    if (!video || prefersReducedMotion || hasFailed) {
      return;
    }

    if (video.paused) {
      manuallyPausedRef.current = false;
      void video.play().catch(() => undefined);
      return;
    }

    manuallyPausedRef.current = true;
    video.pause();
  };

  const toggleMute = () => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const enableEntrySound = () => {
    const video = videoRef.current;

    if (!video || variant !== 'entry' || showPoster) {
      return;
    }

    manuallyPausedRef.current = false;
    video.muted = false;
    setIsMuted(false);
    void video.play().catch(() => undefined);
  };

  const updateCaption = () => {
    const currentTime = videoRef.current?.currentTime || 0;
    const nextIndex = filmCaptions.findIndex((item) => currentTime < item.until);
    setCaptionIndex(nextIndex < 0 ? filmCaptions.length - 1 : nextIndex);
  };

  const showPoster = shouldPresentPastLifePoster(prefersReducedMotion, hasFailed);
  const isEntryVideoVisible = variant !== 'entry' || (isVideoReady && hasPlaybackStarted);

  return (
    <figure className={`dokkaebi-hero-film ${variant === 'entry' ? 'is-entry' : 'is-embedded'}`}>
      <div className="dokkaebi-film-door">
        <span className="dokkaebi-film-brass corner-one" aria-hidden="true" />
        <span className="dokkaebi-film-brass corner-two" aria-hidden="true" />
        <span className="dokkaebi-film-brass corner-three" aria-hidden="true" />
        <span className="dokkaebi-film-brass corner-four" aria-hidden="true" />

        {showPoster ? (
          <img src={poster} alt={`${title} 포스터`} className="dokkaebi-film-media" />
        ) : (
          <video
            ref={videoRef}
            className={`dokkaebi-film-media ${isEntryVideoVisible ? 'is-video-visible' : 'is-video-loading'}`}
            src={src}
            poster={variant === 'entry' ? undefined : poster}
            muted
            loop
            autoPlay
            playsInline
            preload="metadata"
            onPlay={() => setIsPlaying(true)}
            onPlaying={() => {
              setIsVideoReady(true);
              setHasPlaybackStarted(true);
            }}
            onPause={() => setIsPlaying(false)}
            onLoadedData={() => setIsVideoReady(true)}
            onCanPlay={() => setIsVideoReady(true)}
            onTimeUpdate={updateCaption}
            onError={() => {
              setHasFailed(true);
              setIsVideoReady(false);
              setHasPlaybackStarted(false);
            }}
          />
        )}

        {variant === 'entry' && !showPoster && !isEntryVideoVisible ? (
          <div className="dokkaebi-cinematic-loading dokkaebi-film-loading" role="status" aria-live="polite">
            <span className="dokkaebi-cinematic-loading-seal" aria-hidden="true" />
            <strong>{isVideoReady ? '봉인이 열리고 있습니다' : '봉인된 장면을 불러오는 중'}</strong>
            <small>{isVideoReady ? '잠시 후 전생의 문이 열립니다' : '어둠 속 기록을 깨우고 있어요'}</small>
          </div>
        ) : null}

        {variant === 'entry' && isEntryVideoVisible && isMuted ? (
          <button
            type="button"
            className="dokkaebi-entry-sound-prompt"
            onClick={enableEntrySound}
            aria-label="화면을 터치해 영상 소리 켜기"
          >
            <span aria-hidden="true">
              <Hand size={28} strokeWidth={1.7} />
            </span>
            <strong>터치하면 소리가 나옵니다</strong>
          </button>
        ) : null}

        <span className="dokkaebi-film-vignette" aria-hidden="true" />
        <span className="dokkaebi-film-grain" aria-hidden="true" />
        <span className="dokkaebi-film-thread" aria-hidden="true" />
        <span className="dokkaebi-film-flames" aria-hidden="true">
          {Array.from({ length: 7 }, (_, index) => (
            <i key={index} style={{ ['--flame-index' as string]: index }} />
          ))}
        </span>

        <div className="dokkaebi-film-mobile-entry">
          <div className="dokkaebi-film-preview-moment" aria-label="체험 반응 예시">
            <small>체험 반응 예시</small>
            <strong key={previewIndex}>{previewMoments[previewIndex]}</strong>
            <span aria-hidden="true">
              {previewMoments.map((item, index) => (
                <i key={item} className={index === previewIndex ? 'active' : ''} />
              ))}
            </span>
          </div>
          <Link to={actionHref} state={actionState} className="dokkaebi-film-entry-action">
            {actionLabel}
          </Link>
        </div>
      </div>

      <figcaption className="dokkaebi-film-below">
        <p key={captionIndex} aria-live="polite">
          {filmCaptions[captionIndex].text}
        </p>
        <div className="dokkaebi-film-controls" aria-label="대표 영상 제어">
          <button
            type="button"
            onClick={togglePlayback}
            disabled={showPoster}
            aria-label={isPlaying ? '영상 일시정지' : '영상 재생'}
            title={isPlaying ? '영상 일시정지' : '영상 재생'}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
            <span>{isPlaying ? '일시정지' : '재생'}</span>
          </button>
          <button
            type="button"
            onClick={toggleMute}
            disabled={showPoster}
            aria-label={isMuted ? '영상 소리 켜기' : '영상 소리 끄기'}
            title={isMuted ? '영상 소리 켜기' : '영상 소리 끄기'}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            <span>{isMuted ? '소리 켜기' : '소리 끄기'}</span>
          </button>
        </div>
        {prefersReducedMotion ? <small>움직임 감소 설정에 따라 포스터로 표시됩니다.</small> : null}
        {hasFailed ? <small>영상을 불러오지 못해 포스터로 표시됩니다.</small> : null}
      </figcaption>
    </figure>
  );
}
