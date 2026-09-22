import { ArrowLeft, Hand, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { storylinePoster, storylineVideo } from './media';

export default function GuiyeondoIntro({ onEnter }: { onEnter: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const toggleSound = async () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
      if (!nextMuted) await videoRef.current.play().catch(() => undefined);
    }
  };

  return (
    <section className="gy-intro" aria-labelledby="gy-intro-title">
      {/* The other two guiyeondo stages render `.gy-topbar`; the intro did not,
          which left /guiyeondo with no top bar on first load. */}
      <header className="gy-topbar gy-intro-topbar">
        <Link to="/" aria-label="홈으로">
          <ArrowLeft size={20} />
        </Link>
        <strong>귀연도 <span>貴緣圖</span></strong>
        <span />
      </header>

      <div className="gy-intro-media" aria-hidden="true">
        {reducedMotion ? (
          <img src={storylinePoster} alt="" />
        ) : (
          <video ref={videoRef} autoPlay loop muted={muted} playsInline preload="metadata" poster={storylinePoster}>
            <source src={storylineVideo} type="video/mp4" />
          </video>
        )}
        <span className="gy-intro-vignette" />
      </div>
      <button type="button" className="gy-sound-button" onClick={toggleSound} aria-label={muted ? '영상 소리 켜기' : '영상 소리 끄기'} disabled={reducedMotion}>
        {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
        <span>{muted ? '소리 켜기' : '소리 끄기'}</span>
      </button>
      {/* 아이브로우로 있던 한자(貴緣圖)는 상단바 이름표와 같은 글자라, 한 화면에 같은
          글자가 두 번 있었다. 버튼 밑의 "손 모양 버튼을 누르면…" 은 버튼이 이미 손
          모양이라 하는 일을 두 번 말했다. 약관 링크는 이 영상 화면에서만 빼고
          지도·입력·게스트 화면에는 그대로 둔다 — 들어가는 길에 항상 한 번은 나온다. */}
      <div className="gy-intro-copy">
        <h1 id="gy-intro-title">내 인생에 들어온<br />귀한 인연을 그리다</h1>
        <p>누가 나의 귀인이고, 어떤 사람이 오래 남는지<br />두 사람의 명리 구조로 이어봅니다.</p>
        <button type="button" className="gy-primary-button gy-intro-enter" onClick={onEnter}>
          <Hand size={21} aria-hidden="true" />
          귀연도 열기
        </button>
      </div>
    </section>
  );
}
