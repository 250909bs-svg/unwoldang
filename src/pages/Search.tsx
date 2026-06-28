import { ArrowLeft, Search as SearchIcon, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

type SearchProduct = {
  id: string;
  title: string;
  image: string;
  to: string;
  keywords: string[];
};

const searchProducts: SearchProduct[] = [
  {
    id: 'concern-reading',
    title: '운월당 고민풀이',
    image: '/intake-sunlight-girl.png',
    to: '/form/concern-reading',
    keywords: ['고민', '고민풀이', '질문', '상담', '선택', '이사', '퇴사', '연애질문', '진로']
  },
  {
    id: 'general-signature',
    title: '운월선생 정통 종합사주',
    image: '/intake-night-blue.png',
    to: '/form/general-signature',
    keywords: ['종합사주', '사주', '대운', '세운', '인생', '원국', '오행', '십성']
  },
  {
    id: 'love-reading',
    title: '홍연아씨 연애운 리딩',
    image: '/intake-blossom-girl.png',
    to: '/form/love-reading',
    keywords: ['연애', '썸', '인연', '소개팅', '연락', '고백', '애정']
  },
  {
    id: 'love-reunion',
    title: '홍연아씨 재회 가능성',
    image: '/intake-beauty-red.png',
    to: '/form/love-reunion',
    keywords: ['재회', '전남친', '전여친', '이별', '연락', '미련', '다시']
  },
  {
    id: 'match-couple',
    title: '월연도령 사주궁합',
    image: '/intake-beauty-red.png',
    to: '/form/match-couple',
    keywords: ['궁합', '커플', '상대', '결혼궁합', '속궁합', '연인', '배우자']
  },
  {
    id: 'marriage-blueprint',
    title: '청연부인 결혼운 설계도',
    image: '/intake-sunlight-girl.png',
    to: '/form/marriage-blueprint',
    keywords: ['결혼', '결혼운', '배우자', '혼인', '시기', '가정']
  },
  {
    id: 'money-reading',
    title: '운월선생 금전운 설계도',
    image: '/intake-lantern-night.png',
    to: '/form/money-reading',
    keywords: ['재물', '돈', '금전', '사업', '투자', '수익', '매출']
  },
  {
    id: 'career-reading',
    title: '운월선생 직업운 설계도',
    image: '/intake-night-blue.png',
    to: '/form/career-reading',
    keywords: ['직업', '진로', '이직', '퇴사', '창업', '커리어', '일']
  },
  {
    id: 'life-flow',
    title: '운월선생 신년운세',
    image: '/intake-lantern-night.png',
    to: '/form/life-flow',
    keywords: ['신년운세', '올해', '2026', '월별운세', '운세', '시기']
  },
  {
    id: 'tarot',
    title: '운월당 타로 리딩',
    image: '/tarot-lucky-amulet.png',
    to: '/tarot',
    keywords: ['타로', '카드', '연애타로', '재회타로', '결혼타로']
  }
];

const livePopularIds = ['concern-reading', 'love-reading', 'general-signature', 'match-couple', 'money-reading'] as const;
const recommendedKeywords = ['재물', '연애', '궁합', '결혼', '고민'] as const;

function normalizeText(value: string) {
  return value.replace(/\s/g, '').toLowerCase();
}

export default function Search() {
  const [query, setQuery] = useState('');
  const normalizedQuery = normalizeText(query);
  const livePopular = livePopularIds
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

  return (
    <main className="search-page-shell">
      <div className="search-page-inner">
        <header className="search-topbar">
          <Link to="/" className="search-back-button" aria-label="홈으로 돌아가기">
            <ArrowLeft size={21} />
          </Link>
          <label className="search-input-box">
            <SearchIcon size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="검색어를 입력하세요"
            />
            {query ? (
              <button type="button" aria-label="검색어 지우기" onClick={() => setQuery('')}>
                <X size={16} />
              </button>
            ) : null}
          </label>
        </header>

        <section className="search-section">
          <h2>추천 검색어</h2>
          <div className="search-chip-row">
            {recommendedKeywords.map((keyword) => (
              <button key={keyword} type="button" className="search-chip" onClick={() => setQuery(keyword)}>
                {keyword}
              </button>
            ))}
          </div>
        </section>

        <section className="search-section">
          <div className="search-section-title-row">
            <h2>{query ? '검색 결과' : '실시간 인기순'}</h2>
            {!query ? <span className="search-live-badge">LIVE</span> : null}
          </div>
          {results.length ? (
            <div className="search-popular-stack">
              {results.map((product, index) => (
                <Link key={product.id} to={product.to} state={{ tabOrigin: '/search' }} className="search-popular-card">
                  <span className="search-popular-rank">{index + 1}</span>
                  <span className="search-popular-image">
                    <img src={product.image} alt={product.title} />
                  </span>
                  <strong>{product.title}</strong>
                </Link>
              ))}
            </div>
          ) : (
            <div className="search-empty-state">
              <strong>검색 결과가 없습니다</strong>
              <p>재물, 연애, 결혼, 궁합처럼 짧게 검색해보세요.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
