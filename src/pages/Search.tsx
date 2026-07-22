import { Search as SearchIcon, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import LoveReadingCardPicture from '../components/LoveReadingCardPicture';
import MobileTopBar from '../components/MobileTopBar';
import { activeProducts, canDiscoverProduct } from '../products/registry';
import type { ProductId } from '../products/types';
import { EmptyState, Input, LiveRegion } from '../shared/ui';

type SearchProduct = {
  id: ProductId;
  title: string;
  image: string;
  to: string;
  keywords: readonly string[];
};


const optimizedSearchImageSources = new Set([
  '/intake-night-blue.png',
  '/intake-lantern-night.png',
  '/intake-sunlight-girl.png',
  '/intake-beauty-red.png',
  '/intake-blossom-girl.png',
  '/home-yearly-fortune-card.png',
  '/home-concern-reading-card.png',
  '/home-love-reunion-card.png',
  '/home-match-couple-card.png'
]);

function getOptimizedSearchImage(source: string) {
  return optimizedSearchImageSources.has(source) ? source.replace(/\.png$/, '.webp') : source;
}

const searchProducts: SearchProduct[] = activeProducts.map((product) => ({
  id: product.id,
  ...product.search,
  image: getOptimizedSearchImage(product.search.image),
  to: product.routes.detail
}));
const livePopularIds = ['past-life-goblin', 'concern-reading', 'love-reading', 'general-signature', 'match-couple'] as const;
const recommendedKeywords = [
  { label: '전생', productId: 'past-life-goblin' },
  { label: '재물', productId: 'money-reading' },
  { label: '연애', productId: 'love-reading' },
  { label: '궁합', productId: 'match-couple' },
  { label: '고민', productId: 'concern-reading' }
] as const;
const discoverableRecommendedKeywords = recommendedKeywords.filter((keyword) =>
  canDiscoverProduct(keyword.productId)
);

function normalizeText(value: string) {
  return value.replace(/\s/g, '').toLowerCase();
}

export default function Search() {
  const [query, setQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const normalizedQuery = normalizeText(query);
  const livePopular = livePopularIds
    .filter((id) => canDiscoverProduct(id))
    .map((id) => searchProducts.find((product) => product.id === id))
    .filter((product): product is SearchProduct => Boolean(product));
  const results = useMemo(() => {
    if (!normalizedQuery) {
      return livePopular;
    }

    return searchProducts.filter((product) => {
      const target = normalizeText(`${product.title} ${product.keywords.join(' ')}`);
      return target.includes(normalizedQuery);
    });
  }, [livePopular, normalizedQuery]);

  const clearQuery = () => {
    setQuery('');
    searchInputRef.current?.focus();
  };

  return (
    <main className="search-page-shell">
      <MobileTopBar title="검색" backTo="/" backLabel="홈" />

      <div className="search-page-inner">
        <header className="search-topbar">
          <div className="search-input-box">
            <SearchIcon size={18} aria-hidden="true" />
            <Input
              ref={searchInputRef}
              label="상품 검색"
              hideLabel
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="검색어를 입력하세요"
              autoComplete="off"
            />
            {query ? (
              <button type="button" aria-label="검색어 지우기" onClick={clearQuery}>
                <X size={16} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </header>

        <section className="search-section">
          <h2>추천 검색어</h2>
          <div className="search-chip-row">
            {discoverableRecommendedKeywords.map((keyword) => (
              <button
                key={keyword.label}
                type="button"
                className="search-chip"
                onClick={() => setQuery(keyword.label)}
              >
                {keyword.label}
              </button>
            ))}
          </div>
        </section>

        <section className="search-section">
          <div className="search-section-title-row">
            <h2>{query ? '검색 결과' : '실시간 인기순'}</h2>
            {!query ? <span className="search-live-badge">LIVE</span> : null}
          </div>
          <LiveRegion message={query ? `검색 결과 ${results.length}개` : undefined} />
          {results.length ? (
            <div className="search-popular-stack">
              {results.map((product, index) => (
                <Link key={product.id} to={product.to} state={{ tabOrigin: '/search' }} className="search-popular-card">
                  <span className="search-popular-rank">{index + 1}</span>
                  <span className="search-popular-image">
                    {product.id === 'love-reading' ? (
                      <LoveReadingCardPicture alt={product.title} sizes="60px" />
                    ) : (
                      <img src={product.image} alt={product.title} loading="lazy" decoding="async" />
                    )}
                  </span>
                  <strong>{product.title}</strong>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              className="search-empty-state"
              title={<strong>검색 결과가 없습니다</strong>}
              description={<p>재물, 연애, 결혼, 궁합처럼 짧게 검색해보세요.</p>}
            />
          )}
        </section>
      </div>
    </main>
  );
}
