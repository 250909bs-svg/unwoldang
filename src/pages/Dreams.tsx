import {
  Bot,
  ChevronRight,
  Heart,
  Moon,
  Sparkles,
  Stars,
  Users
} from 'lucide-react';
import { Link } from 'react-router-dom';
import MobileTopBar from '../components/MobileTopBar';
import { findServiceById } from '../api/mockData';

const promptCards = [
  { id: 'general-signature', icon: Bot, question: '내 사주 전체 흐름이 궁금해요' },
  { id: 'life-flow', icon: Sparkles, question: '신년운세와 올해 타이밍을 보고 싶어요' },
  { id: 'love-reading', icon: Heart, question: '연애운과 감정 흐름을 알고 싶어요' },
  { id: 'love-reunion', icon: Stars, question: '재회 가능성과 연락 흐름이 궁금해요' },
  { id: 'match-couple', icon: Users, question: '두 사람 궁합과 연결 강도를 보고 싶어요' },
  { id: 'marriage-blueprint', icon: Moon, question: '결혼운과 배우자 흐름을 정리하고 싶어요' }
].map((item) => ({
  ...item,
  service: findServiceById(item.id)
}));

const keywordChips = ['종합사주', '신년운세', '연애운', '재회운', '궁합', '결혼운'] as const;

const flowSteps = [
  '주제를 선택해요',
  '상세페이지를 읽어요',
  '사주정보를 입력해요',
  '결제 후 결과 리포트를 받아요'
] as const;

const previewCards = [
  {
    title: '오늘 많이 찾는 질문',
    body: '“올해 연애운이 들어오는 시기가 언제인지”를 가장 많이 확인하고 있어요.'
  },
  {
    title: 'AI라키 진행 방식',
    body: '바로 답변 시작이 아니라 상세페이지 설명을 본 뒤 고객이 주문 결정을 할 수 있게 바꿨습니다.'
  }
] as const;

export default function Dreams() {
  const detailLinkState = { tabOrigin: '/dreams' } as const;

  return (
    <main className="mobile-page-shell">
      <div className="mobile-page-card">
        <MobileTopBar title="AI라키" backTo="/" backLabel="홈" />

        <section className="mobile-page-content">
          <div className="mobile-hero-card app-tab-hero">
            <span className="mobile-chip">AI LAKI</span>
            <h1>궁금한 주제를 먼저 고르세요</h1>
            <p>이제 AI라키는 바로 채팅으로 들어가지 않고, 운월당 완성본 흐름처럼 주제 선택 후 상세페이지에서 설명을 보고 진행하도록 구성했습니다.</p>

            <div className="app-laki-hero-row">
              <div className="app-laki-avatar">
                <Bot size={22} />
              </div>
              <div className="app-laki-bubble">
                상세 설명을 보고 진행할 수 있게 바뀌어서 구매 흐름이 더 자연스럽게 이어집니다.
              </div>
            </div>
          </div>

          <div className="app-chip-scroll">
            {keywordChips.map((chip) => (
              <span key={chip} className="app-chip-pill">
                {chip}
              </span>
            ))}
          </div>

          <div className="mobile-section-card">
            <div className="mobile-section-head">
              <strong className="mobile-section-title">많이 찾는 AI라키 주제</strong>
              <span className="mobile-inline-label">상세페이지 연결</span>
            </div>

            <div className="app-prompt-stack">
              {promptCards.map((card) => {
                const Icon = card.icon;

                return (
                  <Link
                    key={card.service.id}
                    to={`/detail/${card.service.id}`}
                    state={detailLinkState}
                    className="app-prompt-card"
                  >
                    <span className="app-prompt-icon" style={{ background: `${card.service.accent}18`, color: card.service.accent }}>
                      <Icon size={18} />
                    </span>
                    <div>
                      <strong>{card.service.label}</strong>
                      <p>{card.question}</p>
                    </div>
                    <ChevronRight size={18} />
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="app-collection-grid">
            {previewCards.map((card) => (
              <article key={card.title} className="app-collection-card">
                <strong>{card.title}</strong>
                <p>{card.body}</p>
              </article>
            ))}
          </div>

          <div className="mobile-section-card">
            <strong className="mobile-section-title">진행 방식</strong>
            <div className="app-step-grid">
              {flowSteps.map((step, index) => (
                <article key={step} className="app-step-card">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <p>{step}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
