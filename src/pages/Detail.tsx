import { Check, ChevronRight, Sparkles, Star, TimerReset } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import MobileTopBar from '../components/MobileTopBar';
import { findServiceById } from '../api/mockData';
import { useAuth } from '../context/AuthContext';
import { createOrderId } from '../lib/auth';

type DetailLocationState = {
  tabOrigin?: string;
};

const defaultPreviewCards = [
  {
    title: '질문 2개 맞춤 해석',
    body: '고객이 직접 입력한 질문을 사주 정보와 함께 묶어서 결과 본문에 자연스럽게 녹여냅니다.',
    icon: Sparkles
  },
  {
    title: '핵심 흐름 요약 카드',
    body: '처음 보는 사람도 빠르게 이해할 수 있도록 한눈에 보이는 요약 카드부터 시작합니다.',
    icon: Star
  },
  {
    title: '월별 흐름과 실행 포인트',
    body: '지금부터 어떻게 움직이면 좋은지, 가까운 흐름을 기준으로 실전 조언까지 이어집니다.',
    icon: TimerReset
  }
] as const;

const trustPoints = ['질문 2개 동시 반영', '카드형 요약 + 본문 해석', '결과 리포트 바로 확인'] as const;

export default function Detail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const service = findServiceById(id);
  const locationState = (location.state as DetailLocationState | null) ?? null;
  const tabOrigin = locationState?.tabOrigin || '/';
  const isQuickContentFlow = tabOrigin === '/test' || tabOrigin === '/tarot';

  if (!isQuickContentFlow) {
    return <Navigate to={`/form/${service.id}`} state={{ tabOrigin }} replace />;
  }

  const quickSteps =
    tabOrigin === '/tarot'
      ? ['상세 설명 확인', '바로 타로 결과 열기', '리포트형 해석 확인']
      : ['테스트 설명 확인', '바로 결과 열기', '카드형 해석 확인'];
  const previewCards = isQuickContentFlow
    ? [
        {
          title: tabOrigin === '/tarot' ? '타로 핵심 메시지' : '테스트 핵심 해석',
          body: '입력 단계 없이도 선택한 주제의 핵심 메시지를 바로 읽을 수 있도록 빠르게 연결됩니다.',
          icon: Sparkles
        },
        {
          title: '카드형 요약 블록',
          body: '처음 보는 사람도 부담 없이 읽도록 핵심만 먼저 보여주고, 아래에서 세부 해석을 이어갑니다.',
          icon: Star
        },
        {
          title: '바로 보는 확장 리포트',
          body: '결과 화면 안에서 펼침 섹션을 열며 더 깊은 해석까지 바로 이어서 볼 수 있습니다.',
          icon: TimerReset
        }
      ]
    : defaultPreviewCards;
  const heroSignals = isQuickContentFlow
    ? ['사주 입력 없음', '상세 확인 후 바로 결과', '리딩형 결과 페이지']
    : ['입력폼 한 화면 구성', '질문 2개 동시 분석', '결제 후 리포트 자동 생성'];
  const previewSteps = (isQuickContentFlow ? quickSteps : service.output.slice(0, 3)).slice(0, 3);

  const startStandardFlow = () => {
    if (isAuthenticated) {
      navigate(`/form/${service.id}`, { state: { tabOrigin } });
      return;
    }

    navigate('/login', {
      state: { returnTo: `/form/${service.id}`, from: location.pathname, tabOrigin }
    });
  };

  const startQuickFlow = () => {
    navigate('/loading', {
      state: {
        product: service.id,
        paymentMethod: 'quick',
        orderId: createOrderId(),
        tabOrigin
      }
    });
  };

  const handlePrimaryAction = () => {
    if (isQuickContentFlow) {
      startQuickFlow();
      return;
    }

    startStandardFlow();
  };

  return (
    <main className="mobile-page-shell">
      <div className="mobile-page-card">
        <MobileTopBar title="상세 안내" backTo={tabOrigin} backLabel="목록" backState={{ tabOrigin }} />

        <section className="mobile-page-content detail-luxe-content">
          <section className="detail-luxe-hero" style={{ ['--service-accent' as string]: service.accent }}>
            <div className="detail-luxe-copy">
              <div className="detail-luxe-badge-row">
                <span className="mobile-chip">PREMIUM</span>
                <span className="detail-luxe-chip">{service.heroTag}</span>
              </div>

              <h1>{service.label}</h1>
              <p>{service.subtitle}</p>

              <div className="detail-luxe-signal-row">
                {heroSignals.map((item) => (
                  <span key={item} className="detail-luxe-signal-pill">
                    {item}
                  </span>
                ))}
              </div>

              <div className="detail-luxe-price-row">
                <strong>{service.price}</strong>
                <span>{service.badge}</span>
              </div>
            </div>

            <div className="detail-luxe-side">
              <article className="detail-luxe-side-card">
                <span className="detail-luxe-card-label">추천 포인트</span>
                <strong>{service.spotlight}</strong>
                <p>{service.description}</p>
              </article>

              <article className="detail-luxe-preview-stage">
                <div className="detail-luxe-preview-stage-head">
                  <span>결과 미리보기</span>
                  <small>{isQuickContentFlow ? '빠른 결과 흐름' : '프리미엄 리포트 흐름'}</small>
                </div>

                <div className="detail-luxe-preview-stack">
                  {previewSteps.map((item, index) => (
                    <article key={item} className="detail-luxe-preview-stack-card">
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <strong>{item}</strong>
                    </article>
                  ))}
                </div>
              </article>

              <div className="detail-luxe-stat-grid">
                <article>
                  <span>리포트 구성</span>
                  <strong>{service.output.length}개 섹션</strong>
                </article>
                <article>
                  <span>{isQuickContentFlow ? '시작 방식' : '질문 반영'}</span>
                  <strong>{isQuickContentFlow ? '입력 없이 바로 확인' : '질문 2개 동시 분석'}</strong>
                </article>
                <article>
                  <span>진행 단계</span>
                  <strong>{isQuickContentFlow ? `${quickSteps.length}단계 빠른 진입` : `${service.process.length}단계 주문 흐름`}</strong>
                </article>
              </div>
            </div>
          </section>

          <section className="detail-luxe-trust-row">
            {trustPoints.map((item) => (
              <article key={item} className="detail-luxe-trust-chip">
                <Check size={14} />
                <span>{item}</span>
              </article>
            ))}
          </section>

          <section className="detail-luxe-section">
            <div className="detail-luxe-head">
              <div>
                <span className="detail-luxe-kicker">WHY THIS</span>
                <h2>이런 분께 특히 잘 맞아요</h2>
              </div>
              <p>
                청월당 홈처럼 카드만 훑어도 내용이 이해되도록, 핵심 포인트를 짧고 선명하게 먼저
                보여주는 구조로 정리했습니다.
              </p>
            </div>

            <div className="detail-luxe-feature-grid">
              {service.bullets.map((item) => (
                <article key={item} className="detail-luxe-feature-card">
                  <span className="detail-luxe-check">
                    <Check size={14} />
                  </span>
                  <div>
                    <strong>{item}</strong>
                    <p>결과 페이지 본문에서 더 깊게 풀어주는 핵심 주제입니다.</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="detail-luxe-section soft">
            <div className="detail-luxe-head">
              <div>
                <span className="detail-luxe-kicker">PROCESS</span>
                <h2>진행 방식</h2>
              </div>
              <p>
                {isQuickContentFlow
                  ? '타로와 심리테스트는 사주 정보 입력 없이, 상세를 확인한 뒤 바로 결과 화면으로 이어지도록 정리했습니다.'
                  : '상세를 보고 바로 결제하는 방식이 아니라, 입력과 확인 단계를 충분히 거치도록 설계했습니다.'}
              </p>
            </div>

            <div className="detail-luxe-timeline">
              {(isQuickContentFlow ? quickSteps : service.process).map((item, index) => (
                <article key={item} className="detail-luxe-step">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>{item}</strong>
                    <p>
                      {isQuickContentFlow
                        ? index === 0
                          ? '포함 내용과 결과 스타일을 먼저 보고, 이 주제가 내게 맞는지 가볍게 판단합니다.'
                          : index === 1
                            ? '사주 정보 입력 없이 바로 로딩 화면을 거쳐 결과 페이지로 이어집니다.'
                            : '카드형 요약과 펼침 섹션으로 구성된 결과를 바로 확인합니다.'
                        : index === 0
                          ? '상세 설명과 포함 내용을 먼저 확인합니다.'
                          : index === 1
                            ? '사주 정보와 질문을 차분하게 입력합니다.'
                            : index === 2
                              ? '결제 전 요약 카드로 입력값을 다시 확인합니다.'
                              : '결과 리포트에서 핵심 흐름과 세부 해석을 확인합니다.'}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="detail-luxe-section">
            <div className="detail-luxe-head">
              <div>
                <span className="detail-luxe-kicker">PREVIEW</span>
                <h2>결과는 이런 식으로 나와요</h2>
              </div>
              <p>
                {isQuickContentFlow
                  ? '빠르게 보되 가볍게 끝나지 않도록, 카드형 요약과 펼침 해석을 섞어 밀도 있게 읽히는 구조로 이어집니다.'
                  : '청월당 결과 페이지처럼 정보가 많은데도 읽기 편하게, 구간별로 카드와 펼침 섹션을 섞는 방식으로 이어집니다.'}
              </p>
            </div>

            <div className="detail-luxe-preview-grid">
              {previewCards.map((card) => {
                const Icon = card.icon;

                return (
                  <article key={card.title} className="detail-luxe-preview-card">
                    <span className="detail-luxe-preview-icon">
                      <Icon size={16} />
                    </span>
                    <strong>{card.title}</strong>
                    <p>{card.body}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="detail-luxe-section soft">
            <div className="detail-luxe-head">
              <div>
                <span className="detail-luxe-kicker">INCLUDED</span>
                <h2>포함 내용</h2>
              </div>
              <p>고객이 실제로 받게 되는 결과물 구조를 미리 확인할 수 있습니다.</p>
            </div>

            <div className="detail-luxe-output-list">
              {service.output.map((item, index) => (
                <article key={item} className="detail-luxe-output-card">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{item}</strong>
                  <ChevronRight size={16} />
                </article>
              ))}
            </div>
          </section>

          <section className="detail-luxe-cta-card" style={{ ['--service-accent' as string]: service.accent }}>
            <div>
              <span className="detail-luxe-kicker">READY TO START</span>
              <h2>상세를 다 봤다면 바로 다음 단계로 이어갈게요</h2>
              <p>
                {isQuickContentFlow
                  ? '이 주제는 사주 정보 입력 없이 바로 결과 페이지로 이어집니다. 상세를 다 확인했다면 곧바로 결과를 열어볼 수 있습니다.'
                  : '카카오 로그인 후 사주 정보 입력으로 넘어가면 이름, 성별, 생년월일, 태어난 시간, 질문 2개를 한 번에 입력하고 결제 준비까지 이어집니다.'}
              </p>
            </div>

            <div className="detail-luxe-cta-actions">
              <button type="button" onClick={handlePrimaryAction} className="app-black-button">
                {isQuickContentFlow ? '바로 결과 보기' : isAuthenticated ? '사주 정보 입력하기' : '카카오 로그인 후 시작'}
              </button>
              <Link to={tabOrigin} className="app-muted-button">
                다른 카테고리 더 보기
              </Link>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
