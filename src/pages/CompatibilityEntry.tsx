import CinematicProductIntro from '../components/CinematicProductIntro';
import type { ServiceId } from '../api/mockData';

type CompatibilityServiceId = Extract<ServiceId, 'match-couple' | 'match-destiny'>;

type CompatibilityEntryProps = {
  serviceId: CompatibilityServiceId;
};

// Dedicated couple films can replace this single path without changing the entry flow.
const PROVISIONAL_COMPATIBILITY_VIDEO = '/signature-intake-hero.mp4';
const COMPATIBILITY_POSTER = '/home-match-couple-card.png';

const reviews = {
  'match-couple': [
    '\uc88b\uace0 \ub098\uc068\ubcf4\ub2e4 \uc65c \ubd80\ub52a\ud788\ub294\uc9c0 \uad6c\uccb4\uc801\uc73c\ub85c \uc774\ud574\ub410\uc5b4\uc694',
    '\uac10\uc815 \uc18d\ub3c4\uc640 \uc0dd\ud65c \uad81\ud569\uc744 \ub530\ub85c \ubcf4\ub2c8 \ud6e8\uc52c \ud604\uc2e4\uc801\uc774\uc5c8\uc5b4\uc694',
    '\uc6b0\ub9ac \ub458\uc774 \uc624\ub798 \uac00\ub824\uba74 \ubb34\uc5c7\uc744 \ub9de\ucdb0\uc57c \ud558\ub294\uc9c0 \uc54c\uaca0\uc5b4\uc694'
  ],
  'match-destiny': [
    '\uac15\ud55c \ub04c\ub9bc\uacfc \uc624\ub798 \uac08 \uc778\uc5f0\uc744 \uad6c\ubd84\ud574\uc11c \ubcfc \uc218 \uc788\uc5c8\uc5b4\uc694',
    '\uacb0\ud63c\uae4c\uc9c0 \uc0dd\uac01\ud560 \ub54c \ud655\uc778\ud574\uc57c \ud560 \uae30\uc900\uc774 \uc120\uba85\ud574\uc84c\uc5b4\uc694',
    '\uc6b4\uba85\uc774\ub77c\ub294 \ub9d0\ubcf4\ub2e4 \ud604\uc2e4\uc801\uc778 \uad00\uacc4 \uc870\uac74\uc744 \uc9da\uc5b4\uc918\uc11c \uc88b\uc558\uc5b4\uc694'
  ]
} as const;

export default function CompatibilityEntry({ serviceId }: CompatibilityEntryProps) {
  const isDestiny = serviceId === 'match-destiny';
  const detailPath = `/detail/${serviceId}`;

  return (
    <main className="compatibility-entry-page">
      <CinematicProductIntro
        ariaLabel={isDestiny ? '\uc6d4\uc5f0\ub3c4\ub839 \uc6b4\uba85 \uad81\ud569 \uc601\uc0c1 \uc778\ud2b8\ub85c' : '\uc6d4\uc5f0\ub3c4\ub839 \uc0ac\uc8fc\uad81\ud569 \uc601\uc0c1 \uc778\ud2b8\ub85c'}
        videoLabel={isDestiny ? '\uc6d4\uc5f0\ub3c4\ub839 \uc6b4\uba85 \uad81\ud569 \uc18c\uac1c \uc601\uc0c1' : '\uc6d4\uc5f0\ub3c4\ub839 \uc0ac\uc8fc\uad81\ud569 \uc18c\uac1c \uc601\uc0c1'}
        videoSrc={PROVISIONAL_COMPATIBILITY_VIDEO}
        posterSrc={COMPATIBILITY_POSTER}
        fallbackAlt={isDestiny ? '\ub450 \uc0ac\ub78c\uc758 \uae4a\uc740 \uc778\uc5f0\uc744 \ubcf4\ub294 \uc6d4\uc5f0\ub3c4\ub839 \uc6b4\uba85 \uad81\ud569' : '\ub450 \uc0ac\ub78c\uc758 \uac10\uc815\uacfc \uc0dd\ud65c\uc744 \ubcf4\ub294 \uc6d4\uc5f0\ub3c4\ub839 \uc0ac\uc8fc\uad81\ud569'}
        loadingLabel={isDestiny ? '\ub450 \uc0ac\ub78c\uc758 \uc778\uc5f0\uc744 \uc787\ub294 \uc911' : '\ub450 \uc0ac\ub78c\uc758 \uad81\ud569\uc744 \ubd88\ub7ec\uc624\ub294 \uc911'}
        eyebrow="UNWOLDANG | TWO CHART READING"
        title={isDestiny ? '\uc6d4\uc5f0\ub3c4\ub839 \uc6b4\uba85 \uad81\ud569' : '\uc6d4\uc5f0\ub3c4\ub839 \uc0ac\uc8fc\uad81\ud569'}
        subtitle={isDestiny ? '\ub450 \uc0ac\ub78c\uc758 \uc778\uc5f0\uacfc \uc624\ub798 \uac08 \ud604\uc2e4 \uc870\uac74\uc744 \ud568\uaed8 \ubd05\ub2c8\ub2e4.' : '\ub450 \uc0ac\ub78c\uc758 \uc0ac\uc8fc\ub97c \ub098\ub780\ud788 \ub193\uace0 \uac10\uc815\uacfc \uc0dd\ud65c\uc758 \ud569\uc744 \ubd05\ub2c8\ub2e4.'}
        ctaLabel={isDestiny ? '\uc6b4\uba85 \uad81\ud569 \ubcf4\ub7ec\uac00\uae30' : '\uad81\ud569 \ubcf4\ub7ec\uac00\uae30'}
        ctaTo={`/form/${serviceId}`}
        ctaState={{ tabOrigin: detailPath }}
        reviewMoments={reviews[serviceId]}
        theme="compatibility"
      />
    </main>
  );
}
