import {
  Flame,
  Gem,
  Heart,
  BriefcaseBusiness,
  PiggyBank,
  ScrollText,
  Sparkles,
  User,
  WalletCards
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const illustrationDeck = {
  sunlight: '/intake-sunlight-girl.png',
  red: '/intake-beauty-red.png',
  moon: '/intake-night-blue.png',
  lantern: '/intake-lantern-night.png',
  blossom: '/intake-blossom-girl.png'
} as const;

const mainCategories = [
  { target: 'general-signature', label: '종합사주', icon: ScrollText, tint: '#fff6df' },
  { target: 'life-flow', label: '신년운세', icon: Sparkles, tint: '#f4efff' },
  { target: 'concern-reading', label: '고민풀이', icon: Sparkles, tint: '#eef7ff' },
  { target: 'love-reading', label: '연애운', icon: Heart, tint: '#fff0f5' },
  { target: 'love-reunion', label: '재회운', icon: Heart, tint: '#fff6f8' },
  { target: 'career-reading', label: '직업운', icon: BriefcaseBusiness, tint: '#f6f2ea' },
  { target: 'money-reading', label: '금전운', icon: PiggyBank, tint: '#fff8e7' },
  { path: '/tarot', label: '타로', icon: WalletCards, tint: '#fff1f5' }
] as const;

const cardNewsSlides = [
  {
    id: 'news-general',
    target: 'general-signature',
    rank: 1,
    kicker: '종합사주',
    title: '운월 정통 종합사주',
    subtitle: '타고난 흐름 · 일 · 관계 · 재물 운세 종합 분석',
    image: illustrationDeck.moon,
    tone: 'indigo'
  },
  {
    id: 'news-star-sign',
    target: 'concern-reading',
    rank: 2,
    kicker: '고민풀이',
    title: '운월당 고민풀이',
    subtitle: '지금 고민 2개를 사주 구조와 대운으로 바로 정리',
    image: illustrationDeck.blossom,
    tone: 'rose'
  },
  {
    id: 'news-compatibility',
    target: 'match-couple',
    rank: 3,
    kicker: '궁합 연애운',
    title: '월연도령 사주궁합',
    subtitle: '두 사람의 인연 강도 · 갈등 포인트 · 연애 궁합',
    image: illustrationDeck.red,
    tone: 'violet'
  },
  {
    id: 'news-monthly',
    target: 'life-flow',
    rank: 4,
    kicker: '신년운세',
    title: '운월선생 신년운세',
    subtitle: '다가오는 12개월 흐름과 월별 선택 타이밍',
    image: illustrationDeck.lantern,
    tone: 'amber'
  },
  {
    id: 'news-tarot-love',
    target: 'marriage-blueprint',
    rank: 5,
    kicker: '결혼운',
    title: '청연부인 결혼운 설계도',
    subtitle: '배우자 흐름 · 혼인 적기 · 현실 체크 포인트',
    image: illustrationDeck.sunlight,
    tone: 'emerald'
  }
] as const;

const homeDiscoverySections = [
  {
    id: 'love-cluster',
    title: '썸, 연애, 재회, 일단 들어와 봐요',
    icon: Heart,
    cards: [
      {
        id: 'love-reading',
        to: '/form/love-reading',
        image: illustrationDeck.blossom,
        coverKicker: '홍연아씨',
        coverTitle: '연애비책',
        title: '홍연아씨 연애비책',
        summary: '썸 단계부터 연락법까지'
      },
      {
        id: 'love-reunion',
        to: '/form/love-reunion',
        image: illustrationDeck.moon,
        coverKicker: '홍연아씨',
        coverTitle: '재회비책',
        title: '홍연아씨 재회비책',
        summary: '나의 재회 가능성은?'
      },
      {
        id: 'match-couple',
        to: '/form/match-couple',
        image: illustrationDeck.red,
        coverKicker: '월연도령',
        coverTitle: '궁합비책',
        title: '월연도령 사주궁합',
        summary: '두 사람의 인연 강도는?'
      }
    ]
  },
  {
    id: 'new-arrivals',
    title: '따끈한 신상 운세 들어왔어요',
    icon: Flame,
    cards: [
      {
        id: 'general-signature',
        to: '/form/general-signature',
        image: illustrationDeck.moon,
        coverKicker: '운월선생',
        coverTitle: '종합사주',
        title: '운월선생 정통 종합사주',
        summary: '인생 전반의 흐름과 선택 기준'
      },
      {
        id: 'concern-reading',
        to: '/form/concern-reading',
        image: illustrationDeck.sunlight,
        coverKicker: '운월당',
        coverTitle: '고민풀이',
        title: '운월당 고민풀이',
        summary: '지금 고민 2개를 바로 해석'
      },
      {
        id: 'life-flow',
        to: '/form/life-flow',
        image: illustrationDeck.lantern,
        coverKicker: '운월선생',
        coverTitle: '월별운세',
        title: '운월선생 월별운세',
        summary: '이번 달 흐름을 먼저 읽어보세요'
      }
    ]
  },
  {
    id: 'future-preview',
    title: '내 인생, 미리보기 하고싶다면?',
    icon: Sparkles,
    cards: [
      {
        id: 'life-flow',
        to: '/form/life-flow',
        image: illustrationDeck.lantern,
        coverKicker: '청월아씨',
        coverTitle: '신년운세',
        title: '운월선생 신년운세',
        summary: '올해와 내년의 흐름 지도'
      },
      {
        id: 'match-destiny',
        to: '/form/match-destiny',
        image: illustrationDeck.red,
        coverKicker: '월연도령',
        coverTitle: '운명궁합',
        title: '월연도령 운명 궁합',
        summary: '오래 갈 인연인지 보는 궁합'
      },
      {
        id: 'marriage-blueprint',
        to: '/form/marriage-blueprint',
        image: illustrationDeck.blossom,
        coverKicker: '청연부인',
        coverTitle: '결혼운',
        title: '청연부인 결혼운 설계도',
        summary: '배우자 흐름과 혼인 준비'
      }
    ]
  },
  {
    id: 'premium-luck',
    title: '나도 상위 1% 가능하다고?',
    icon: Gem,
    cards: [
      {
        id: 'wealth',
        to: '/form/money-reading',
        image: illustrationDeck.sunlight,
        coverKicker: '운월선생',
        coverTitle: '직업·재물',
        title: '직업·재물 종합 분석',
        summary: '일과 돈이 붙는 구조 읽기'
      },
      {
        id: 'career',
        to: '/form/career-reading',
        image: illustrationDeck.moon,
        coverKicker: '운월선생',
        coverTitle: '직업비책',
        title: '커리어 흐름 분석',
        summary: '직업 방향과 일 스타일'
      },
      {
        id: 'marriage-timing',
        to: '/form/marriage-timing',
        image: illustrationDeck.lantern,
        coverKicker: '청연부인',
        coverTitle: '혼인적기',
        title: '청연부인 혼인 적기',
        summary: '결혼 시기와 안정감 체크'
      }
    ]
  }
] as const;

export default function Home() {
  const [activeCardNewsIndex, setActiveCardNewsIndex] = useState(0);
  const visibleCardNews = cardNewsSlides
    .map((slide, index) => ({
      ...slide,
      offset: (index - activeCardNewsIndex + cardNewsSlides.length) % cardNewsSlides.length
    }))
    .filter((slide) => slide.offset <= 2);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveCardNewsIndex((prev) => (prev + 1) % cardNewsSlides.length);
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="app-home-shell">
      <div className="app-mobile-shell">
        <header className="app-home-header">
          <Link to="/" className="mobile-topbar-brand" aria-label="운월당 홈">
            운월당
          </Link>

          <div className="app-header-actions">
            <Link to="/my" className="app-profile-button" aria-label="마이페이지">
              <User size={17} strokeWidth={2.2} />
            </Link>
          </div>
        </header>

        <section className="report-tab-row">
          <button type="button" className="report-tab active">
            운세
          </button>
          <button type="button" className="report-tab">
            연애·궁합
          </button>
          <button type="button" className="report-tab">
            돈·직업
          </button>
        </section>

        <section className="home-cardnews-wrap" aria-label="상단 카드뉴스">
          <div className="home-cardnews-stage">
            {visibleCardNews.map((slide) => (
              <Link
                key={slide.id}
                to={`/form/${slide.target}`}
                state={{ tabOrigin: '/' }}
                className={
                  slide.offset === 0
                    ? `home-cardnews-card active tone-${slide.tone}`
                    : slide.offset === 1
                      ? `home-cardnews-card next tone-${slide.tone}`
                      : `home-cardnews-card tail tone-${slide.tone}`
                }
                aria-hidden={slide.offset !== 0}
                tabIndex={slide.offset === 0 ? 0 : -1}
              >
                <img src={slide.image} alt={`${slide.kicker} 카드뉴스`} className="home-cardnews-image" />
                <span className="home-cardnews-rank">TOP {slide.rank}</span>
                <div className="home-cardnews-overlay" />
                <div className="home-cardnews-copy">
                  <small>{slide.kicker}</small>
                  <h2>{slide.title}</h2>
                  <p>{slide.subtitle}</p>
                </div>
              </Link>
            ))}
          </div>

          <div className="home-cardnews-dots" role="tablist" aria-label="카드뉴스 선택">
            {cardNewsSlides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={activeCardNewsIndex === index}
                className={activeCardNewsIndex === index ? 'home-cardnews-dot active' : 'home-cardnews-dot'}
                onClick={() => setActiveCardNewsIndex(index)}
              />
            ))}
          </div>
        </section>

        <section className="home-block">
          <h2>전체 카테고리</h2>
          <div className="live-category-grid">
            {mainCategories.map((category) => {
              const Icon = category.icon;

              return (
                <Link
                  key={`${category.label}-${'target' in category ? category.target : category.path}`}
                  to={'target' in category ? `/form/${category.target}` : category.path}
                  state={{ tabOrigin: '/' }}
                  className="live-category-card"
                >
                  <span className="live-category-icon" style={{ background: category.tint }}>
                    <Icon size={18} />
                  </span>
                  <strong>{category.label}</strong>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="home-showcase-stack">
          {homeDiscoverySections.map((section) => {
            const Icon = section.icon;

            return (
              <section key={section.id} className="home-showcase-section">
                <div className="home-showcase-head">
                  <span className="home-showcase-icon">
                    <Icon size={14} />
                  </span>
                  <strong>{section.title}</strong>
                </div>

                <div className="home-showcase-rail">
                  {section.cards.map((card) => (
                    <Link key={card.id} to={card.to} state={{ tabOrigin: '/' }} className="home-showcase-card">
                      <article className="home-showcase-cover">
                        <img src={card.image} alt={card.title} className="home-showcase-cover-image" />
                        <div className="home-showcase-cover-overlay" />
                        <div className="home-showcase-cover-copy">
                          <small>{card.coverKicker}</small>
                          <h3>{card.coverTitle}</h3>
                        </div>
                      </article>
                      <div className="home-showcase-meta">
                        <strong>{card.title}</strong>
                        <p>{card.summary}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </section>
      </div>
    </main>
  );
}
