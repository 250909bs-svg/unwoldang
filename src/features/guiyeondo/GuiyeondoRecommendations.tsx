import { ArrowUpRight, HeartHandshake } from 'lucide-react';
import { Link } from 'react-router-dom';
import { canDiscoverProduct, getProductById } from '../../products/registry';
import type { ProductId } from '../../products/types';
import { trackGuiyeondoEvent } from './events';
import { celestialCoupleImage } from './media';
import type { GuiyeondoRelationshipType } from './types';

const recommendationCopy: Partial<Record<ProductId, { eyebrow: string; description: string; image: string }>> = {
  'general-signature': {
    eyebrow: '내 인생 전체 흐름',
    description: '귀연도가 두 사람 사이의 결을 봤다면, 종합사주는 그 인연을 선택하는 내 원국과 대운을 더 넓게 읽어요.',
    image: '/home-general-saju-card.avif'
  },
  'love-reading': {
    eyebrow: '연애 패턴 집중 분석',
    description: '한 사람과의 관계를 넘어 내가 끌리는 사람과 관계가 꼬이는 지점을 더 세밀하게 살펴봐요.',
    image: '/home-love-reading-card-496.avif'
  }
};

const recommendationIds = ['general-signature', 'love-reading'] as const satisfies readonly ProductId[];

export default function GuiyeondoRecommendations({
  compact = false,
  relationType,
  onConnect
}: {
  compact?: boolean;
  relationType?: GuiyeondoRelationshipType | null;
  onConnect?: () => void;
}) {
  const recommendations = recommendationIds
    .filter((id) => canDiscoverProduct(id))
    .map((id) => ({ product: getProductById(id), copy: recommendationCopy[id]! }));

  if (recommendations.length === 0 && compact) return null;

  return (
    <section className={`gy-recommendations ${compact ? 'is-compact' : ''}`} aria-labelledby="gy-recommend-title">
      <div className="gy-section-title">
        <span>NEXT READING</span>
        <h3 id="gy-recommend-title">이 인연 다음에 자연스럽게 이어보기</h3>
        <p>궁합을 더 연결하거나, 내 사주 전체 흐름으로 시야를 넓혀보세요.</p>
      </div>
      <div className="gy-recommendation-list">
        {!compact && onConnect ? (
          <button
            type="button"
            className="gy-recommendation-card gy-recommendation-compatibility"
            onClick={() => { trackGuiyeondoEvent('guiyeondo_report_cta', {
              source: 'relationship-detail',
              relationType: relationType || 'unclassified',
              productId: 'guiyeondo-more'
            }); onConnect(); }}
          >
            <img src={celestialCoupleImage} alt="" loading="lazy" decoding="async" />
            <span className="gy-recommendation-shade" aria-hidden="true" />
            <div>
              <small>다른 관계도 이어보기</small>
              <strong><HeartHandshake size={19} /> 새 인연 궁합 보기</strong>
              <p>친구, 연인, 가족, 동료를 연결해 관계마다 달라지는 신호를 비교해 보세요.</p>
              <span>귀연도에 인연 추가 <ArrowUpRight size={15} /></span>
            </div>
          </button>
        ) : null}
        {recommendations.map(({ product, copy }) => (
          <Link
            to={product.routes.detail}
            className="gy-recommendation-card"
            key={product.id}
            onClick={() => trackGuiyeondoEvent('guiyeondo_report_cta', {
              source: compact ? 'guest-result' : 'relationship-detail',
              relationType: relationType || 'unclassified',
              productId: product.id
            })}
          >
            <img src={copy.image} alt="" loading="lazy" decoding="async" />
            <span className="gy-recommendation-shade" aria-hidden="true" />
            <div>
              <small>{copy.eyebrow}</small>
              <strong>{product.displayName}</strong>
              <p>{copy.description}</p>
              <span>자세히 보기 <ArrowUpRight size={15} /></span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
