import {
  BriefcaseBusiness,
  CheckCircle2,
  Flame,
  Gem,
  Heart,
  PiggyBank,
  ScrollText,
  ShieldCheck,
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
  { target: 'love-reading', label: '연애운', icon: Heart, tint: '#f8f3ea' },
  { target: 'marriage-blueprint', label: '결혼운', icon: Gem, tint: '#fff6f0' },
  { target: 'love-reunion', label: '재회운', icon: Heart, tint: '#f3f1ed' },
  { target: 'general-signature', label: '직업운', icon: BriefcaseBusiness, tint: '#f6f2ea' },
  { target: 'life-flow', label: '금전운', icon: PiggyBank, tint: '#fff8e7' },
  { path: '/tarot', label: '타로', icon: WalletCards, tint: '#f7f0e6' }
] as const;

const cardNewsSlides = [
  {
    id: 'news-general',
    target: 'general-signature',
    rank: 1,
    kicker: '운월당 대표 감정서',
    title: '정통 종합사주',
    subtitle: '원국, 대운, 세운, 질문 2개까지 한 번에 정리',
    image: illustrationDeck.moon,
    tone: 'indigo'
  },
  {
    id: 'news-love',
    target: 'love-reading',
    rank: 2,
    kicker: '관계의 온도',
    title: '연애운 정밀 리포트',
    subtitle: '끌리는 사람, 오래 가는 조건, 피해야 할 인연',
    image: illustrationDeck.blossom,
    tone: 'amber'
  },
  {
    id: 'news-career',
    target: 'general-signature',
    rank: 3,
    kicker: '일과 돈의 흐름',
    title: '커리어·재물 방향',
    subtitle: '확장보다 남는 구조를 먼저 잡는 현실 조언',
    image: illustrationDeck.sunlight,
    tone: 'emerald'
  },
  {
    id: 'news-year',
    target: 'life-flow',
    rank: 4,
    kicker: '2026 흐름',
    title: '월별 운세 캘린더',
    subtitle: '움직일 달과 정리할 달을 구분해 보는 연간 흐름',
    image: illustrationDeck.lantern,
    tone: 'violet'
  }
] as const;

const merchandisingSections = [
  {
    id: 'signature',
    title: '처음이라면 이 리포트부터',
    icon: ShieldCheck,
    cards: [
      {
        id: 'general-signature',
        to: '/form/general-signature',
        image: illustrationDeck.moon,
        coverKicker: 'SIGNATURE',
        coverTitle: '종합사주',
        title: '운월선생 정통 종합사주',
        summary: '사주 원국, 오행, 십성, 대운, 질문 답변까지 한 번에 보는 대표 상품'
      },
      {
        id: 'life-flow',
        to: '/form/life-flow',
        image: illustrationDeck.lantern,
        coverKicker: 'YEAR FLOW',
        coverTitle: '신년운세',
        title: '2026 인생 흐름 리포트',
        summary: '강하게 움직일 달과 조심할 달을 월운 캘린더로 정리'
      },
      {
        id: 'career',
        to: '/form/general-signature',
        image: illustrationDeck.sunlight,
        coverKicker: 'WORK & MONEY',
        coverTitle: '직업·재물',
        title: '커리어·재물 방향 분석',
        summary: '지금 넓힐 것과 줄일 것을 현실 기준으로 구분'
      }
    ]
  },
  {
    id: 'love',
    title: '연애, 재회, 결혼이 고민이라면',
    icon: Heart,
    cards: [
      {
        id: 'love-reading',
        to: '/form/love-reading',
        image: illustrationDeck.blossom,
        coverKicker: 'LOVE',
        coverTitle: '연애운',
        title: '연애운 정밀 리포트',
        summary: '상대가 보는 나, 오래 가는 사람, 피해야 할 관계 패턴'
      },
      {
        id: 'love-reunion',
        to: '/form/love-reunion',
        image: illustrationDeck.moon,
        coverKicker: 'REUNION',
        coverTitle: '재회운',
        title: '재회 가능성 리포트',
        summary: '미련과 가능성을 나누고 다시 연락할 타이밍을 정리'
      },
      {
        id: 'marriage-blueprint',
        to: '/form/marriage-blueprint',
        image: illustrationDeck.red,
        coverKicker: 'MARRIAGE',
        coverTitle: '결혼운',
        title: '결혼운·배우자 흐름',
        summary: '배우자상, 현실 조건, 결혼 후 생활 리듬까지 확인'
      }
    ]
  },
  {
    id: 'quick',
    title: '가볍게 먼저 보고 싶다면',
    icon: Flame,
    cards: [
      {
        id: 'tarot',
        to: '/tarot',
        image: illustrationDeck.red,
        coverKicker: '5분 순삭',
        coverTitle: '타로',
        title: '오늘의 타로 리딩',
        summary: '부담 없이 먼저 확인하는 빠른 리딩'
      },
      {
        id: 'test',
        to: '/test',
        image: illustrationDeck.sunlight,
        coverKicker: 'SNACK',
        coverTitle: '심리 테스트',
        title: '나를 보는 간단 테스트',
        summary: '사주 전 가볍게 보는 성향 체크'
      },
      {
        id: 'face',
        to: '/test/face-ai',
        image: illustrationDeck.blossom,
        coverKicker: 'AI',
        coverTitle: '관상 맛보기',
        title: 'AI 관상 미리보기',
        summary: '무료 콘텐츠로 먼저 운월당 톤을 체험'
      }
    ]
  }
] as const;

const freePreviewItems = [
  {
    title: '오행 간단 판정',
    body: '강한 기운과 보완할 기운을 먼저 보여주고, 전체 리포트에서 근거를 자세히 풉니다.'
  },
  {
    title: '올해 핵심 키워드',
    body: '올해 움직일 방향을 한 문장으로 먼저 확인하고, 결제 후 월별 흐름까지 열립니다.'
  },
  {
    title: '질문 2개 예고',
    body: '고객 질문을 기준으로 “지금 확인할 것”과 “미뤄야 할 것”을 분리해 보여줍니다.'
  }
] as const;

const launchTrustItems = [
  '만세력 계산값과 AI 해석을 분리해 검증',
  '결과 저장과 마이페이지 다시보기 지원',
  '오타·불일치 신고 후 개선 가능한 구조',
  '질병, 투자, 법률 등 위험한 단정 금지'
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
    }, 1800);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="app-home-shell launch-home-shell">
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

        <section className="launch-hero-panel">
          <span>PREMIUM SAJU REPORT</span>
          <h1>가볍게 보는 운세보다, 실제 선택에 쓰는 사주 감정서</h1>
          <p>원국, 오행, 십성, 대운과 고객 질문을 함께 읽어 지금 무엇을 해야 하는지까지 정리합니다.</p>
          <div className="launch-hero-actions">
            <Link to="/form/general-signature" state={{ tabOrigin: '/' }} className="app-black-button">
              대표 리포트 시작
            </Link>
            <a href="#free-preview" className="app-muted-button">
              무료 맛보기
            </a>
          </div>
        </section>

        <section className="home-cardnews-wrap" aria-label="인기 리포트">
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
                <img src={slide.image} alt={`${slide.kicker} 카드`} className="home-cardnews-image" />
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

          <div className="home-cardnews-dots" role="tablist" aria-label="인기 리포트 선택">
            {cardNewsSlides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-label={`${slide.title} 보기`}
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

        <section id="free-preview" className="launch-preview-panel">
          <div className="launch-section-head">
            <span>FREE PREVIEW</span>
            <h2>결제 전, 이런 식으로 먼저 보여드립니다</h2>
            <p>무료 맛보기는 방향을 짧게 확인하고, 결제 후 전체 근거와 실행전략을 여는 구조입니다.</p>
          </div>
          <div className="launch-preview-grid">
            {freePreviewItems.map((item) => (
              <article key={item.title}>
                <CheckCircle2 size={17} />
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
          <Link to="/form/general-signature" state={{ tabOrigin: '/' }} className="app-black-button">
            무료 맛보기 후 전체 리포트 보기
          </Link>
        </section>

        <section className="home-showcase-stack">
          {merchandisingSections.map((section) => {
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

        <section className="launch-trust-panel">
          <div className="launch-section-head">
            <span>TRUST CHECK</span>
            <h2>출시 전 신뢰 기준</h2>
          </div>
          <div className="launch-trust-list">
            {launchTrustItems.map((item) => (
              <div key={item}>
                <ShieldCheck size={16} />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div className="launch-legal-links">
            <Link to="/terms">이용약관</Link>
            <Link to="/privacy">개인정보처리방침</Link>
            <Link to="/refund">환불정책</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
