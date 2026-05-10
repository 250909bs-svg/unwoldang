import type { CSSProperties } from 'react';
import { Brain, Hand, Heart, Scan, Sparkles, Star, Users, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import MobileTopBar from '../components/MobileTopBar';

type TestItem = {
  id: string;
  title: string;
  subtitle: string;
  badge?: string;
  isNew?: boolean;
  comingSoon?: boolean;
  accentClass: string;
  icon: typeof Scan;
  image: string;
  path: string;
};

const testItems: TestItem[] = [
  {
    id: 'face-ai',
    title: 'AI 관상',
    subtitle: '얼굴로 보는 운명',
    badge: 'HOT',
    isNew: true,
    accentClass: 'violet',
    icon: Scan,
    image: '/test-crystal.png',
    path: '/test/face-ai'
  },
  {
    id: 'palm-ai',
    title: 'AI 손금',
    subtitle: '손금으로 보는 미래',
    badge: 'NEW',
    isNew: true,
    accentClass: 'sky',
    icon: Hand,
    image: '/test-meditation.png',
    path: '/test/palm-ai',
    comingSoon: true
  },
  {
    id: 'mbti',
    title: 'MBTI 테스트',
    subtitle: '진짜 나의 MBTI는?',
    accentClass: 'cyan',
    icon: Brain,
    image: '/test-thinking.png',
    path: '/test/mbti',
    comingSoon: true
  },
  {
    id: 'love-test',
    title: '연애 심리테스트',
    subtitle: '나의 연애 스타일',
    accentClass: 'rose',
    icon: Heart,
    image: '/test-dreamy-stars.png',
    path: '/test/love',
    comingSoon: true
  },
  {
    id: 'aura',
    title: '오라 테스트',
    subtitle: '나의 오라 색깔은?',
    accentClass: 'amber',
    icon: Sparkles,
    image: '/test-book.png',
    path: '/test/aura',
    comingSoon: true
  },
  {
    id: 'compatibility',
    title: '궁합 테스트',
    subtitle: '우리 얼마나 맞을까?',
    accentClass: 'emerald',
    icon: Users,
    image: '/test-moon-dance.png',
    path: '/test/compatibility',
    comingSoon: true
  },
  {
    id: 'luck',
    title: '행운 지수',
    subtitle: '오늘의 럭키 포인트',
    accentClass: 'yellow',
    icon: Star,
    image: '/test-star-character.png',
    path: '/test/luck',
    comingSoon: true
  },
  {
    id: 'energy',
    title: '에너지 테스트',
    subtitle: '나의 에너지 타입',
    accentClass: 'indigo',
    icon: Zap,
    image: '/test-crystal.png',
    path: '/test/energy',
    comingSoon: true
  }
];

export default function Test() {
  const featuredKeywords = ['AI 관상', '연애 심리', '궁합 테스트', '행운 지수'];

  return (
    <main className="mobile-page-shell">
      <div className="mobile-page-card">
        <MobileTopBar title="심리테스트" backTo="/" backLabel="홈" />

        <section className="mobile-page-content test-lab-page">
          <section className="test-lab-banner">
            <div className="test-lab-brand-mark">
              <span className="test-lab-brand-orbit orbit-a" />
              <span className="test-lab-brand-orbit orbit-b" />
              <Sparkles size={18} />
            </div>
            <div>
              <span className="test-lab-badge-chip">운월당 AI 테스트</span>
              <h1>
                AI가 분석하는
                <br />
                나만의 특별한 테스트들
              </h1>
              <p>얼굴, 손금, 심리까지 실제 운월당 테스트 화면처럼 가볍게 들어와 바로 체험할 수 있게 정리했습니다.</p>
            </div>
            <img src="/test-star-character.png" alt="" className="test-lab-hero-character" />
          </section>

          <section className="test-lab-marquee" aria-label="추천 테스트 키워드">
            {featuredKeywords.map((keyword, index) => (
              <span key={keyword} className="test-lab-marquee-chip" style={{ ['--chip-index' as string]: index } as CSSProperties}>
                {keyword}
              </span>
            ))}
          </section>

          <section className="test-lab-section">
            <div className="test-lab-section-head">
              <h2>전체 테스트</h2>
              <p>실제로 열려 있는 테스트와 준비 중인 테스트를 한 번에 볼 수 있어요.</p>
            </div>

            <div className="test-lab-grid">
              {testItems.map((item, index) => {
                const Icon = item.icon;
                const badgeLabel = item.comingSoon ? '준비중' : item.badge || (item.isNew ? 'NEW' : undefined);

                if (item.comingSoon) {
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`test-lab-card ${item.accentClass} disabled`}
                      style={{ ['--card-index' as string]: index } as CSSProperties}
                      disabled
                    >
                      <span className="test-lab-card-shine" />
                      {badgeLabel ? <span className="test-lab-card-badge muted">{badgeLabel}</span> : null}
                      <span className="test-lab-card-image">
                        <img src={item.image} alt="" />
                      </span>
                      <span className={`test-lab-card-icon ${item.accentClass}`}>
                        <Icon size={24} />
                      </span>
                      <strong>{item.title}</strong>
                      <p>{item.subtitle}</p>
                    </button>
                  );
                }

                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    className={`test-lab-card ${item.accentClass}`}
                    style={{ ['--card-index' as string]: index } as CSSProperties}
                  >
                    <span className="test-lab-card-shine" />
                    {badgeLabel ? <span className="test-lab-card-badge">{badgeLabel}</span> : null}
                    <span className="test-lab-card-image">
                      <img src={item.image} alt="" />
                    </span>
                    <span className={`test-lab-card-icon ${item.accentClass}`}>
                      <Icon size={24} />
                    </span>
                    <strong>{item.title}</strong>
                    <p>{item.subtitle}</p>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="test-lab-footer-note">
            <p>
              테스트 결과는 엔터테인먼트와 자기 탐색 용도로 제공됩니다.
              <br />
              실제 의사결정은 충분히 신중하게 판단해 주세요.
            </p>
          </section>
        </section>
      </div>
    </main>
  );
}
