import CinematicProductIntro from '../components/CinematicProductIntro';

// Temporary launch asset: replace only this path when the dedicated reunion film is delivered.
const PROVISIONAL_REUNION_VIDEO = '/signature-intake-hero.mp4';
const REUNION_POSTER = '/home-love-reunion-card.png';

const reunionReviewMoments = [
  '연락할지 기다릴지 판단할 기준이 생겼어요',
  '좋은 말뿐 아니라 멈춰야 할 이유도 보여줘서 믿음이 갔어요',
  '재회보다 같은 이별을 반복하지 않을 방법을 먼저 알게 됐어요'
] as const;

export default function ReunionEntry() {
  return (
    <main className="reunion-entry-page">
      <CinematicProductIntro
        ariaLabel="MZ큐피트 재회운 영상 인트로"
        videoLabel="MZ큐피트 재회운 소개 영상"
        videoSrc={PROVISIONAL_REUNION_VIDEO}
        posterSrc={REUNION_POSTER}
        fallbackAlt="붉은 인연의 실과 도깨비가 등장하는 MZ큐피트 재회운"
        loadingLabel="재회의 문을 불러오는 중"
        eyebrow="UNWOLDANG | RELATION READING"
        title={'MZ\ud050\ud53c\ud2b8 \uc7ac\ud68c\uc6b4'}
        subtitle={'\ub2e4\uc2dc \ub9cc\ub098\uae30 \uc804\uc5d0, \uac19\uc740 \uc774\ubcc4\uc774 \ubc18\ubcf5\ub420 \uc870\uac74\ubd80\ud130.'}
        ctaLabel="재회 보러가기"
        ctaTo="/form/love-reunion"
        ctaState={{ tabOrigin: '/detail/love-reunion' }}
        reviewMoments={reunionReviewMoments}
        theme="reunion"
      />
    </main>
  );
}
