import { Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type HeroFilmProps = {
  src: string;
  poster: string;
  title: string;
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

export default function HeroFilm({ src, poster, title }: HeroFilmProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const manuallyPausedRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [hasFailed, setHasFailed] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [captionIndex, setCaptionIndex] = useState(0);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncPreference = () => setPrefersReducedMotion(media.matches);

    syncPreference();
    media.addEventListener('change', syncPreference);
    return () => media.removeEventListener('change', syncPreference);
  }, []);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || prefersReducedMotion || hasFailed) {
      video?.pause();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.45 && !manuallyPausedRef.current) {
          void video.play().catch(() => undefined);
          return;
        }

        video.pause();
      },
      { threshold: [0, 0.45, 0.75] }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, [hasFailed, prefersReducedMotion]);

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

  const updateCaption = () => {
    const currentTime = videoRef.current?.currentTime || 0;
    const nextIndex = filmCaptions.findIndex((item) => currentTime < item.until);
    setCaptionIndex(nextIndex < 0 ? filmCaptions.length - 1 : nextIndex);
  };

  const showPoster = hasFailed || prefersReducedMotion;

  return (
    <figure className="dokkaebi-hero-film">
      <div className="dokkaebi-film-mobile-context">
        <span>사주에 남은 오래된 흔적을 깨우는 시간</span>
        <strong>도깨비 전생장부: 봉인록</strong>
      </div>
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
            className="dokkaebi-film-media"
            src={src}
            poster={poster}
            muted
            loop
            autoPlay
            playsInline
            preload="metadata"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={updateCaption}
            onError={() => setHasFailed(true)}
          />
        )}

        <span className="dokkaebi-film-vignette" aria-hidden="true" />
        <span className="dokkaebi-film-grain" aria-hidden="true" />
        <span className="dokkaebi-film-thread" aria-hidden="true" />
        <span className="dokkaebi-film-flames" aria-hidden="true">
          {Array.from({ length: 7 }, (_, index) => (
            <i key={index} style={{ ['--flame-index' as string]: index }} />
          ))}
        </span>
      </div>

      <figcaption className="dokkaebi-film-below">
        <p key={captionIndex} aria-live="polite">
          {filmCaptions[captionIndex].text}
        </p>
        <div className="dokkaebi-film-controls" aria-label="대표 영상 제어">
          <button type="button" onClick={togglePlayback} disabled={showPoster} aria-label={isPlaying ? '영상 일시정지' : '영상 재생'}>
            {isPlaying ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
            <span>{isPlaying ? '일시정지' : '재생'}</span>
          </button>
          <button type="button" onClick={toggleMute} disabled={showPoster} aria-label={isMuted ? '영상 소리 켜기' : '영상 소리 끄기'}>
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
