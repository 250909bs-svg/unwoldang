import { ArrowLeft, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PAST_LIFE_PRODUCT } from '../content/pastLifeExperience';

const nextStoryState = { tabOrigin: '/' } as const;

export default function PastLifeImmersion() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [showChoices, setShowChoices] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

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

  const revealChoicesBeforeEnd = () => {
    const video = videoRef.current;

    if (!video || !Number.isFinite(video.duration)) {
      return;
    }

    const revealLead = Math.min(5, Math.max(2.8, video.duration * 0.18));
    if (video.duration - video.currentTime <= revealLead) {
      setShowChoices(true);
    }
  };

  const toggleSound = () => {
    const video = videoRef.current;

    if (!video || hasFailed || prefersReducedMotion) {
      return;
    }

    video.muted = !video.muted;
    setIsMuted(video.muted);
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
            className="dokkaebi-immersion-media"
          />
        ) : (
          <video
            ref={videoRef}
            src={PAST_LIFE_PRODUCT.immersionFilm}
            poster={PAST_LIFE_PRODUCT.poster}
            className="dokkaebi-immersion-media"
            muted
            autoPlay
            playsInline
            preload="auto"
            onTimeUpdate={revealChoicesBeforeEnd}
            onEnded={() => setShowChoices(true)}
            onError={() => {
              setHasFailed(true);
              setShowChoices(true);
            }}
          />
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
