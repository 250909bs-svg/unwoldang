import { Hand, Volume2, VolumeX } from 'lucide-react';
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
      <div className="gy-intro-copy">
        <span className="gy-eyebrow">貴緣圖</span>
        <h1 id="gy-intro-title">내 인생에 들어온<br />귀한 인연을 그리다</h1>
        <p>누가 나의 귀인이고, 어떤 사람이 오래 남는지<br />두 사람의 명리 구조로 이어봅니다.</p>
        <button type="button" className="gy-primary-button gy-intro-enter" onClick={onEnter}>
          <Hand size={21} aria-hidden="true" />
          귀연도 열기
        </button>
        <span className="gy-intro-note">손 모양 버튼을 누르면 인연의 지도가 열립니다</span>
        <p className="gy-legal-links"><Link to="/privacy">개인정보처리방침</Link><span> · </span><Link to="/terms">이용약관</Link></p>
      </div>
    </section>
  );
}
