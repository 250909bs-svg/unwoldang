import { Menu as MenuIcon, MessageCircle, Play, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MobileTopBar from '../components/MobileTopBar';
import { readStoredAuthUser } from '../lib/auth';

const illustrationDeck = {
  generalSaju: '/home-general-saju-card.png',
  yearlyFortune: '/home-yearly-fortune-card.png',
  concernReading: '/home-concern-reading-card.png',
  loveReading: '/home-love-reading-card.png',
  loveReunion: '/home-love-reunion-card.png',
  matchCouple: '/home-match-couple-card.png',
  sunlight: '/intake-sunlight-girl.png',
  red: '/intake-beauty-red.png',
  moon: '/intake-night-blue.png',
  lantern: '/intake-lantern-night.png',
  blossom: '/intake-blossom-girl.png'
} as const;

const homeMenuItems = [
  { label: '종합사주', to: '/form/general-signature', state: { tabOrigin: '/' } },
  { label: '고민풀이', to: '/form/concern-reading', state: { tabOrigin: '/' } },
  { label: '심리테스트', to: '/test' },
  { label: '마이페이지', to: '/my' }
] as const;

const supportMailHref =
  'mailto:250909bs@gmail.com?subject=%EC%9A%B4%EC%9B%94%EB%8B%B9%20%EB%AC%B8%EC%9D%98';

const homeCategoryTabs = [
  { id: 'all', label: '전체' },
  { id: 'general', label: '종합' },
  { id: 'love', label: '연애' },
  { id: 'reunion', label: '재회' },
  { id: 'marriage', label: '결혼' },
  { id: 'match', label: '궁합' },
  { id: 'wealth', label: '재물' }
] as const;

const cardNewsSlides = [
  {
    id: 'news-general',
    target: 'general-signature',
    rank: 1,
    kicker: '종합사주',
    title: '운월 정통 종합사주',
    subtitle: '타고난 흐름 · 일 · 관계 · 재물 운세 종합 분석',
    image: illustrationDeck.generalSaju,
    tone: 'indigo'
  },
  {
    id: 'news-yearly',
    target: 'life-flow',
    rank: 2,
    kicker: '신년운세',
    title: '운월선생 신년운세',
    subtitle: '다가오는 12개월 흐름과 월별 선택 타이밍',
    image: illustrationDeck.yearlyFortune,
    tone: 'amber'
  },
  {
    id: 'news-concern',
    target: 'concern-reading',
    rank: 3,
    kicker: '고민풀이',
    title: '운월당 고민풀이',
    subtitle: '지금 고민 2개를 사주 구조와 대운으로 바로 정리',
    image: illustrationDeck.concernReading,
    tone: 'rose'
  },
  {
    id: 'news-love',
    target: 'love-reading',
    rank: 4,
    kicker: '연애운',
    title: '운월당 연애운',
    subtitle: '끌림과 인연 흐름, 관계의 속도를 함께 분석',
    image: illustrationDeck.loveReading,
    tone: 'violet'
  },
  {
    id: 'news-reunion',
    target: 'love-reunion',
    rank: 5,
    kicker: '재회운',
    title: '운월당 재회운',
    subtitle: '다시 이어질 가능성과 연락 타이밍을 정리',
    image: illustrationDeck.loveReunion,
    tone: 'emerald'
  }
] as const;

type HomeCategoryId = (typeof homeCategoryTabs)[number]['id'];
type HomeProductCategory = Exclude<HomeCategoryId, 'all'> | 'all-only';

type HomeProductCard = {
  id: string;
  category: HomeProductCategory;
  to: string;
  image: string;
  title: string;
  subtitle: string;
  imagePosition?: string;
};

const homeProductCards: HomeProductCard[] = [
  {
    id: 'general-signature',
    category: 'general',
    to: '/form/general-signature',
    image: illustrationDeck.generalSaju,
    title: '운월선생 정통 종합사주',
    subtitle: '타고난 기질부터 인생 전체 흐름까지'
  },
  {
    id: 'love-reading',
    category: 'love',
    to: '/form/love-reading',
    image: illustrationDeck.loveReading,
    title: '홍연아씨 연애운',
    subtitle: '다가올 인연과 마음의 타이밍'
  },
  {
    id: 'love-reunion',
    category: 'reunion',
    to: '/form/love-reunion',
    image: illustrationDeck.loveReunion,
    title: '홍연아씨 재회운',
    subtitle: '다시 이어질 가능성과 연락 시기'
  },
  {
    id: 'marriage-blueprint',
    category: 'marriage',
    to: '/form/marriage-blueprint',
    image: illustrationDeck.blossom,
    title: '청연부인 결혼운 설계도',
    subtitle: '배우자 흐름과 현실적인 혼인 기준'
  },
  {
    id: 'marriage-timing',
    category: 'marriage',
    to: '/form/marriage-timing',
    image: illustrationDeck.lantern,
    title: '청연부인 혼인 적기',
    subtitle: '결혼이 안정되는 시기와 선택 포인트'
  },
  {
    id: 'match-couple',
    category: 'match',
    to: '/form/match-couple',
    image: illustrationDeck.matchCouple,
    title: '월연도령 사주궁합',
    subtitle: '두 사람의 속도와 생활 궁합 분석'
  },
  {
    id: 'match-destiny',
    category: 'match',
    to: '/form/match-destiny',
    image: illustrationDeck.red,
    title: '월연도령 운명 궁합',
    subtitle: '오래 이어질 인연인지 보는 깊은 궁합'
  },
  {
    id: 'money-reading',
    category: 'wealth',
    to: '/form/money-reading',
    image: illustrationDeck.sunlight,
    title: '운월선생 재물운 설계도',
    subtitle: '돈이 들어오고 머무는 나만의 흐름'
  },
  {
    id: 'life-flow',
    category: 'all-only',
    to: '/form/life-flow',
    image: illustrationDeck.yearlyFortune,
    title: '운월선생 신년운세',
    subtitle: '다가오는 12개월의 기회와 조심할 시기'
  },
  {
    id: 'concern-reading',
    category: 'all-only',
    to: '/form/concern-reading',
    image: illustrationDeck.concernReading,
    title: '운월당 고민풀이',
    subtitle: '지금 가장 답답한 고민을 사주로 정리'
  },
  {
    id: 'career-reading',
    category: 'all-only',
    to: '/form/career-reading',
    image: illustrationDeck.moon,
    title: '운월선생 직업운 설계도',
    subtitle: '직업 방향과 나에게 맞는 일의 방식'
  }
];

const homeDiscoverySections = [
  {
    id: 'love-cluster',
    eyebrow: '연애 · 재회 분야',
    title: '썸, 연애, 재회, 일단 들어와 봐요',
    cards: [
      {
        id: 'love-reading',
        to: '/form/love-reading',
        image: illustrationDeck.loveReading,
        coverKicker: '홍연아씨',
        coverTitle: '연애비책',
        title: '홍연아씨 연애비책',
        summary: '썸 단계부터 연락법까지'
      },
      {
        id: 'love-reunion',
        to: '/form/love-reunion',
        image: illustrationDeck.loveReunion,
        coverKicker: '홍연아씨',
        coverTitle: '재회비책',
        title: '홍연아씨 재회비책',
        summary: '나의 재회 가능성은?'
      },
      {
        id: 'match-couple',
        to: '/form/match-couple',
        image: illustrationDeck.matchCouple,
        coverKicker: '월연도령',
        coverTitle: '궁합비책',
        title: '월연도령 사주궁합',
        summary: '두 사람의 인연 강도는?'
      }
    ]
  },
  {
    id: 'new-arrivals',
    eyebrow: '종합사주 분야',
    title: '따끈한 신상 운세 들어왔어요',
    cards: [
      {
        id: 'general-signature',
        to: '/form/general-signature',
        image: illustrationDeck.generalSaju,
        coverKicker: '운월선생',
        coverTitle: '종합사주',
        title: '운월선생 정통 종합사주',
        summary: '인생 전반의 흐름과 선택 기준'
      },
      {
        id: 'concern-reading',
        to: '/form/concern-reading',
        image: illustrationDeck.concernReading,
        coverKicker: '운월당',
        coverTitle: '고민풀이',
        title: '운월당 고민풀이',
        summary: '지금 고민 2개를 바로 해석'
      },
      {
        id: 'life-flow',
        to: '/form/life-flow',
        image: illustrationDeck.yearlyFortune,
        coverKicker: '운월선생',
        coverTitle: '월별운세',
        title: '운월선생 월별운세',
        summary: '이번 달 흐름을 먼저 읽어보세요'
      }
    ]
  },
  {
    id: 'future-preview',
    eyebrow: '운세 · 궁합 분야',
    title: '내 인생, 미리보기 하고싶다면?',
    cards: [
      {
        id: 'life-flow',
        to: '/form/life-flow',
        image: illustrationDeck.yearlyFortune,
        coverKicker: '운월선생',
        coverTitle: '신년운세',
        title: '운월선생 신년운세',
        summary: '올해와 내년의 흐름 지도'
      },
      {
        id: 'match-destiny',
        to: '/form/match-destiny',
        image: illustrationDeck.matchCouple,
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
    eyebrow: '직업 · 재물 분야',
    title: '나도 상위 1% 가능하다고?',
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
  const [activeHomeCategory, setActiveHomeCategory] = useState<HomeCategoryId>('all');
  const [menuOpen, setMenuOpen] = useState(
    () => new URLSearchParams(window.location.search).get('menu') === 'open'
  );
  const [authUser, setAuthUser] = useState(() => readStoredAuthUser());
  const menuNickname = authUser?.nickname?.trim() || '운월당 회원';
  const menuStatusLabel = authUser
    ? authUser.provider === 'kakao'
      ? '카카오 로그인'
      : '테스트 로그인'
    : '로그인 전';
  const menuAvatar = authUser?.avatar || illustrationDeck.sunlight;
  const activeCategoryLabel =
    homeCategoryTabs.find((category) => category.id === activeHomeCategory)?.label || '전체';
  const visibleProducts =
    activeHomeCategory === 'all'
      ? []
      : homeProductCards.filter((product) => product.category === activeHomeCategory);
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

  useEffect(() => {
    const syncAuthUser = () => setAuthUser(readStoredAuthUser());

    window.addEventListener('focus', syncAuthUser);
    window.addEventListener('storage', syncAuthUser);

    return () => {
      window.removeEventListener('focus', syncAuthUser);
      window.removeEventListener('storage', syncAuthUser);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeWithEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeWithEscape);
    };
  }, [menuOpen]);

  return (
    <main className="app-home-shell">
      <div className="app-mobile-shell">
        <MobileTopBar
          title="운월당"
          rightSlot={
            <button
              type="button"
              className="app-menu-button primary-topbar-menu"
              aria-label="운월당 메뉴 열기"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <MenuIcon size={24} strokeWidth={2.2} />
            </button>
          }
        />

        {menuOpen ? (
          <div className="home-menu-overlay" role="presentation" onClick={() => setMenuOpen(false)}>
            <aside
              className="home-menu-panel"
              role="dialog"
              aria-modal="true"
              aria-label="운월당 메뉴"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="home-menu-profile">
                <span className="home-menu-avatar" aria-hidden="true">
                  <img src={menuAvatar} alt="" />
                </span>
                <div className="home-menu-profile-copy">
                  <strong>{menuNickname}</strong>
                  <span>{menuStatusLabel}</span>
                </div>
                <button
                  type="button"
                  className="home-menu-close"
                  aria-label="메뉴 닫기"
                  onClick={() => setMenuOpen(false)}
                >
                  <X size={18} strokeWidth={2.35} />
                </button>
              </div>

              <nav className="home-menu-list" aria-label="운월당 주요 메뉴">
                {homeMenuItems.map((item) => (
                  <Link
                    key={item.label}
                    to={item.to}
                    state={'state' in item ? item.state : undefined}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              <div className="home-menu-contact">
                <a href={supportMailHref} className="home-menu-kakao">
                  <MessageCircle size={15} fill="currentColor" strokeWidth={2.2} />
                  <span>카카오톡 문의</span>
                </a>
                <p>운영시간 평일 09:00~18:00</p>
              </div>
            </aside>
          </div>
        ) : null}

        <nav className="home-category-nav" aria-label="운월당 카테고리">
          <div
            className="home-category-rail"
            onWheel={(event) => {
              if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
                return;
              }

              const rail = event.currentTarget;
              const canMoveRight = event.deltaY > 0 && rail.scrollLeft < rail.scrollWidth - rail.clientWidth;
              const canMoveLeft = event.deltaY < 0 && rail.scrollLeft > 0;

              if (canMoveRight || canMoveLeft) {
                event.preventDefault();
                rail.scrollLeft += event.deltaY;
              }
            }}
          >
            {homeCategoryTabs.map((category) => (
              <button
                key={category.id}
                type="button"
                className={activeHomeCategory === category.id ? 'home-category-tab active' : 'home-category-tab'}
                aria-pressed={activeHomeCategory === category.id}
                onClick={() => setActiveHomeCategory(category.id)}
              >
                {category.label}
              </button>
            ))}
          </div>
        </nav>

        {activeHomeCategory === 'all' ? (
          <>
            <section id="home-all" className="home-cardnews-wrap" aria-label="상단 카드뉴스">
              <div className="home-cardnews-stage">
                {visibleCardNews.map((slide) => (
                  <Link
                    key={slide.id}
                    to={`/form/${slide.target}`}
                    state={{ tabOrigin: '/' }}
                    className={
                      slide.offset === 0
                        ? `home-cardnews-card active tone-${slide.tone}${slide.image.startsWith('/home-') ? ' poster-card' : ''}`
                        : slide.offset === 1
                          ? `home-cardnews-card next tone-${slide.tone}${slide.image.startsWith('/home-') ? ' poster-card' : ''}`
                          : `home-cardnews-card tail tone-${slide.tone}${slide.image.startsWith('/home-') ? ' poster-card' : ''}`
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

            <section className="home-showcase-stack">
              {homeDiscoverySections.map((section) => (
                <section id={`home-${section.id}`} key={section.id} className="home-showcase-section">
                  <div className="home-showcase-head">
                    <small className="home-showcase-kicker">{section.eyebrow}</small>
                    <strong>{section.title}</strong>
                  </div>

                  <div className="home-showcase-rail">
                    {section.cards.map((card) => (
                      <Link key={card.id} to={card.to} state={{ tabOrigin: '/' }} className="home-showcase-card">
                        <article
                          className={
                            card.image.startsWith('/home-')
                              ? 'home-showcase-cover poster-cover'
                              : 'home-showcase-cover'
                          }
                        >
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
              ))}
            </section>
          </>
        ) : (
          <section
            className="home-filtered-products"
            aria-label={`${activeCategoryLabel} 사주 목록`}
            aria-live="polite"
          >
            {visibleProducts.map((product) => (
              <Link
                key={product.id}
                to={product.to}
                state={{ tabOrigin: '/' }}
                className="home-filter-product-card"
              >
                <img
                  src={product.image}
                  alt=""
                  className="home-filter-product-image"
                  style={product.imagePosition ? { objectPosition: product.imagePosition } : undefined}
                />
                <span className="home-filter-product-shade" aria-hidden="true" />
                <span className="home-filter-product-copy">
                  <strong>{product.title}</strong>
                  <small>{product.subtitle}</small>
                </span>
                <span className="home-filter-product-play" aria-hidden="true">
                  <Play size={18} fill="currentColor" strokeWidth={1.8} />
                </span>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
