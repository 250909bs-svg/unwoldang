import { ArrowRight, Hand, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const VIDEO_SRC = '/media/mz-love-reading-intro.mp4';
const FALLBACK_IMAGE = '/home-love-reading-card.webp';
const reportFeatures = [
  '끌리는 타입과 오래 갈 타입을 명리 근거로 나눠 봐요',
  '반복 패턴과 위험 신호를 현실 행동으로 확인해요',
  '12개월 흐름과 30일 행동 계획을 함께 정리해요'
] as const;

export default function LoveReadingIntro() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [featureIndex, setFeatureIndex] = useState(0);
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
      setFeatureIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setFeatureIndex((current) => (current + 1) % reportFeatures.length);
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

        <div className="mz-love-intro-review" aria-label="개인화 리포트 구성">
          <small>리포트 구성</small>
          <strong key={featureIndex}>{reportFeatures[featureIndex]}</strong>
          <span className="mz-love-intro-review-dots" aria-hidden="true">
            {reportFeatures.map((feature, index) => (
              <i key={feature} className={index === featureIndex ? 'is-active' : ''} />
            ))}
          </span>
        </div>

        <div className="mz-love-intro-action">
          <a href="#mz-love-choice" aria-label="팩폭 연애운 상세의 연애 반응 선택으로 이동">
            <Sparkles size={18} aria-hidden="true" />
            <strong>내 연애 반응부터 보기</strong>
            <ArrowRight size={20} aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}
