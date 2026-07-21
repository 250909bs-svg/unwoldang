import { ArrowRight, Hand, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const VIDEO_SRC = '/media/mz-love-reading-intro.mp4';
const FALLBACK_IMAGE = '/home-love-reading-card.webp';
const reviewMoments = [
  '사람은 달라도 왜 같은 연애를 반복했는지 보였어요',
  '팩폭인데 이상하게 위로받는 기분이었어요',
  '다음 연애에서 뭘 바꿔야 할지 딱 알겠어요'
] as const;

export default function LoveReadingIntro() {
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
    if (prefersReducedMotion) {
      setReviewIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setReviewIndex((current) => (current + 1) % reviewMoments.length);
    }, 4600);

    return () => window.clearInterval(timer);
  }, [prefersReducedMotion]);

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

  return (
    <section className="mz-love-intro" aria-label="MZ무당 팩폭 연애운 영상 인트로">
      <div className="mz-love-intro-stage">
        {showFallback ? (
          <img
            className="mz-love-intro-media is-visible"
            src={FALLBACK_IMAGE}
            alt="MZ무당 팩폭 연애운"
            width={992}
            height={1586}
          />
        ) : (
          <video
            ref={videoRef}
            className={`mz-love-intro-media ${hasStarted ? 'is-visible' : ''}`}
            src={VIDEO_SRC}
            muted={isMuted}
            autoPlay
            loop
            playsInline
            preload="auto"
            aria-label="MZ무당 팩폭 연애운 소개 영상"
            onPlaying={() => setHasStarted(true)}
            onError={() => setHasFailed(true)}
          />
        )}

        {!showFallback && !hasStarted ? (
          <div className="mz-love-intro-loading" role="status" aria-live="polite">
            <span aria-hidden="true" />
            <strong>팩폭 연애운을 불러오는 중</strong>
          </div>
        ) : null}

        {!showFallback && hasStarted && isMuted ? (
          <button type="button" className="mz-love-intro-sound" onClick={enableSound}>
            <Hand size={22} aria-hidden="true" />
            <span>화면을 터치하면 소리가 나옵니다</span>
          </button>
        ) : null}

        <span className="mz-love-intro-shade" aria-hidden="true" />

        <div className="mz-love-intro-review" aria-label="체험 반응 예시">
          <small>후기 예시</small>
          <strong key={reviewIndex}>{reviewMoments[reviewIndex]}</strong>
          <span className="mz-love-intro-review-dots" aria-hidden="true">
            {reviewMoments.map((review, index) => (
              <i key={review} className={index === reviewIndex ? 'is-active' : ''} />
            ))}
          </span>
        </div>

        <div className="mz-love-intro-action">
          <Link
            to="/form/love-reading"
            state={{ tabOrigin: '/detail/love-reading' }}
            aria-label="팩폭 연애운 사주정보 입력하기"
          >
            <Sparkles size={18} aria-hidden="true" />
            <strong>팩폭 연애운 보기</strong>
            <ArrowRight size={20} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
