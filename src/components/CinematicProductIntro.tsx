import { ArrowRight, Hand, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/cinematic-product-intro.css';

export type CinematicProductIntroProps = {
  ariaLabel: string;
  videoLabel: string;
  videoSrc: string;
  posterSrc: string;
  fallbackAlt: string;
  loadingLabel: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  ctaLabel: string;
  ctaTo: string;
  ctaState?: Record<string, unknown>;
  reviewMoments: readonly string[];
  reviewLabel?: string;
  theme?: 'reunion' | 'compatibility';
};

export default function CinematicProductIntro({
  ariaLabel,
  videoLabel,
  videoSrc,
  posterSrc,
  fallbackAlt,
  loadingLabel,
  eyebrow,
  title,
  subtitle,
  ctaLabel,
  ctaTo,
  ctaState,
  reviewMoments,
  reviewLabel = '후기 예시',
  theme = 'reunion'
}: CinematicProductIntroProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncPreference = () => setPrefersReducedMotion(media.matches);

    media.addEventListener('change', syncPreference);
    return () => media.removeEventListener('change', syncPreference);
  }, []);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || prefersReducedMotion || hasFailed) {
      video?.pause();
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      void video.play().catch(() => undefined);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          void video.play().catch(() => undefined);
          return;
        }

        video.pause();
      },
      { threshold: 0.12 }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, [hasFailed, prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion || reviewMoments.length < 2) {
      setReviewIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setReviewIndex((current) => (current + 1) % reviewMoments.length);
    }, 4600);

    return () => window.clearInterval(timer);
  }, [prefersReducedMotion, reviewMoments]);

  const enableSound = () => {
    const video = videoRef.current;

    if (!video || hasFailed || prefersReducedMotion) {
      return;
    }

    video.muted = false;
    setIsMuted(false);
    void video.play().catch(() => undefined);
  };

  const showFallback = hasFailed || prefersReducedMotion;
  const activeReview = reviewMoments[reviewIndex] || '';

  return (
    <section
      className={`cinematic-product-intro cinematic-product-intro--${theme}`}
      aria-label={ariaLabel}
    >
      <div className="cinematic-product-intro__stage">
        {showFallback ? (
          <img
            className="cinematic-product-intro__media is-visible"
            src={posterSrc}
            alt={fallbackAlt}
          />
        ) : (
          <video
            ref={videoRef}
            className={`cinematic-product-intro__media ${hasStarted ? 'is-visible' : ''}`}
            src={videoSrc}
            poster={posterSrc}
            muted={isMuted}
            autoPlay
            loop
            playsInline
            preload="auto"
            aria-label={videoLabel}
            onPlaying={() => setHasStarted(true)}
            onError={() => setHasFailed(true)}
          />
        )}

        {!showFallback && !hasStarted ? (
          <div className="cinematic-product-intro__loading" role="status" aria-live="polite">
            <span aria-hidden="true" />
            <strong>{loadingLabel}</strong>
          </div>
        ) : null}

        {!showFallback && hasStarted && isMuted ? (
          <button
            type="button"
            className="cinematic-product-intro__sound"
            onClick={enableSound}
          >
            <Hand size={22} aria-hidden="true" />
            <span>화면을 터치하면 소리가 나옵니다</span>
          </button>
        ) : null}

        <span className="cinematic-product-intro__shade" aria-hidden="true" />

        {title ? (
          <div className="cinematic-product-intro__brand">
            {eyebrow ? <span>{eyebrow}</span> : null}
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
        ) : null}

        {activeReview ? (
          <div className="cinematic-product-intro__review" aria-label="체험 반응 예시">
            <small>{reviewLabel}</small>
            <strong key={reviewIndex}>{activeReview}</strong>
          </div>
        ) : null}

        <div className="cinematic-product-intro__action">
          <Link to={ctaTo} state={ctaState} aria-label={`${ctaLabel} 사주정보 입력하기`}>
            <Sparkles size={18} aria-hidden="true" />
            <strong>{ctaLabel}</strong>
            <ArrowRight size={20} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
