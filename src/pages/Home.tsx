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
  { target: 'love-reading', label: '연애운', icon: Heart, tint: '#fff0f5' },
  { target: 'marriage-blueprint', label: '결혼운', icon: Sparkles, tint: '#fff6f0' },
  { target: 'love-reunion', label: '재회운', icon: Heart, tint: '#fff6f8' },
  { target: 'general-signature', label: '직업운', icon: BriefcaseBusiness, tint: '#f6f2ea' },
  { target: 'life-flow', label: '금전운', icon: PiggyBank, tint: '#fff8e7' },
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
    target: 'life-flow',
    rank: 2,
    kicker: '별자리 운세',
    title: '별자리 운세 리딩',
    subtitle: '다가오는 12개월 흐름과 월별 포인트 해석',
    image: illustrationDeck.blossom,
    tone: 'rose'
  },
  {
    id: 'news-compatibility',
    target: 'match-couple',
    rank: 3,
    kicker: '궁합 연애운',
    title: '천생연분 궁합운',
    subtitle: '두 사람의 인연 강도 · 갈등 포인트 · 연애 궁합',
    image: illustrationDeck.red,
    tone: 'violet'
  },
  {
    id: 'news-monthly',
    target: 'life-flow',
    rank: 4,
    kicker: '월별 운세',
    title: '운둔의 월별 운세',
    subtitle: '한 달 단위 운의 흐름과 선택 타이밍',
    image: illustrationDeck.lantern,
    tone: 'amber'
  },
  {
    id: 'news-tarot-love',
    target: 'love-reading',
    rank: 5,
    kicker: '타로 연애 운세',
    title: '타로 카드 연애 운세',
    subtitle: '지금 상대 흐름 · 감정선 · 다가갈 타이밍',
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
        coverKicker: '운월의 29금',
        coverTitle: '절정비책',
        title: '운월의 29금 절정비책',
        summary: '내 사주 속 쾌락과 유혹의 비밀'
      },
      {
        id: 'marriage-blueprint',
        to: '/form/marriage-blueprint',
        image: illustrationDeck.sunlight,
        coverKicker: '청월아씨',
        coverTitle: '자녀사주',
        title: '청월아씨 자녀사주',
        summary: '아이 앞에 펼쳐진 운명의 지도'
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
        coverTitle: '정통사주',
        title: '청월아씨 정통사주',
        summary: '내 안에 펼쳐진 운명의 지도'
      },
      {
        id: 'match-destiny',
        to: '/form/match-destiny',
        image: illustrationDeck.red,
        coverKicker: '몽월소녀',
        coverTitle: '가미두수',
        title: '몽월소녀 자미두수',
        summary: '지미두수로 보는 나의 운명'
      },
      {
        id: 'life-flow-2026',
        to: '/form/life-flow',
        image: illustrationDeck.blossom,
        coverKicker: '월하소',
        coverTitle: '2026비',
        title: '월하소 2026비',
        summary: '2026년 미리보기'
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
        to: '/form/life-flow',
        image: illustrationDeck.sunlight,
        coverKicker: '운월선생',
        coverTitle: '재물비책',
        title: '운월선생 재물비책',
        summary: '돈이 붙는 시기와 기회 읽기'
      },
      {
        id: 'career',
        to: '/form/general-signature',
        image: illustrationDeck.moon,
        coverKicker: '운월선생',
        coverTitle: '직업비책',
        title: '운월선생 직업비책',
        summary: '일, 승진, 이동운의 포인트'
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
            운세보고서
          </button>
          <button type="button" className="report-tab">
            인맥보고서
          </button>
          <button type="button" className="report-tab">
            행운보고서
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

        <section className="home-seo-panel" aria-labelledby="home-seo-title">
          <span className="home-seo-eyebrow">UNWOLDANG PREMIUM SAJU</span>
          <h1 id="home-seo-title">운월당 사주, 종합사주부터 신년운세와 연애운까지</h1>
          <p>
            운월당은 사주 원국과 대운, 세운의 흐름을 바탕으로 종합사주, 신년운세, 연애운, 결혼운,
            재회운, 궁합을 읽는 프리미엄 리포트 서비스입니다. 단순한 오늘의 운세가 아니라 현재
            고민과 앞으로의 선택 기준을 함께 정리해 고객이 다시 읽고 싶은 결과지를 만드는 것을
            목표로 합니다.
          </p>
          <div className="home-seo-keywords" aria-label="운월당 주요 검색어">
            <Link to="/detail/general-signature">종합사주</Link>
            <Link to="/detail/life-flow">신년운세</Link>
            <Link to="/detail/love-reading">연애운</Link>
            <Link to="/detail/marriage-blueprint">결혼운</Link>
            <Link to="/detail/love-reunion">재회운</Link>
            <Link to="/detail/match-couple">사주궁합</Link>
            <Link to="/tarot">타로</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
