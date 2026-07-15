import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import HeroFilm from '../components/HeroFilm';
import { PAST_LIFE_PRODUCT } from '../content/pastLifeExperience';

const startState = { tabOrigin: '/' } as const;

export default function PastLifeEntry() {
  return (
    <main className="dokkaebi-entry-page" aria-label="MZ 도깨비 전생사주 입장">
      <header className="dokkaebi-entry-head">
        <Link to="/" className="dokkaebi-entry-back" aria-label="홈으로 돌아가기">
          <ArrowLeft size={22} aria-hidden="true" />
        </Link>
        <Link to="/" className="dokkaebi-entry-brand" aria-label="운월당 홈">
          운월당
        </Link>
        <span className="dokkaebi-entry-head-spacer" aria-hidden="true" />
      </header>

      <HeroFilm
        src={PAST_LIFE_PRODUCT.film}
        poster={PAST_LIFE_PRODUCT.poster}
        title={PAST_LIFE_PRODUCT.name}
        actionHref="/form/past-life-goblin"
        actionLabel="전생체험 하러가기"
        actionState={startState}
        variant="entry"
      />
    </main>
  );
}
