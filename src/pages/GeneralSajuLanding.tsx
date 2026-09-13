import { Hand } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import MobileTopBar from '../components/MobileTopBar';
import '../styles/general-saju.css';

const FORM_PATH = '/form/general-signature';
const formState = { tabOrigin: '/detail/general-saju' } as const;
const VIDEO_SOURCE = '/general-saju-entry.mp4';

export default function GeneralSajuLanding() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [hasVideoFailed, setHasVideoFailed] = useState(false);

  const enableSound = () => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.muted = false;
    setIsMuted(false);
    void video.play().catch(() => undefined);
  };

  return (
    <main className="general-saju-entry-page">
      <MobileTopBar title="운월당" />

      <section className="general-saju-entry-stage" aria-labelledby="general-saju-entry-title">
        <h1 id="general-saju-entry-title" className="general-saju-entry-sr-only">
          청담동 0.001% 종합사주
        </h1>

        <div className="general-saju-entry-film">
          {hasVideoFailed ? (
            <picture>
              <source media="(min-width: 601px)" srcSet="/home-general-saju-premium-cover-941.jpg" />
              <img
                src="/home-general-saju-premium-cover-600.jpg"
                alt="청담동 0.001% 종합사주, 당신의 운명을 가장 우아하게 해석하다"
                width="941"
                height="1672"
              />
            </picture>
          ) : (
            <video
              ref={videoRef}
              src={VIDEO_SOURCE}
              poster="/home-general-saju-premium-cover-600.jpg"
              aria-label="청담동 0.001% 종합사주 소개 영상"
              autoPlay
              muted={isMuted}
              loop
              playsInline
              preload="auto"
              onCanPlay={() => {
                void videoRef.current?.play().catch(() => undefined);
              }}
              onError={() => setHasVideoFailed(true)}
            />
          )}

          <span className="general-saju-entry-vignette" aria-hidden="true" />

          {!hasVideoFailed && isMuted ? (
            <button
              type="button"
              className="general-saju-entry-sound"
              onClick={enableSound}
              aria-label="영상 소리 재생"
            >
              <Hand size={34} aria-hidden="true" />
              <span>클릭하면 소리가 나요</span>
            </button>
          ) : null}
        </div>

        <div className="general-saju-entry-action">
          <Link to={FORM_PATH} state={formState} className="general-saju-entry-cta">
            <strong>종합사주 보러가기</strong>
          </Link>
        </div>
      </section>
    </main>
  );
}
