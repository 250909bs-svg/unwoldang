import { ArrowRight, BookOpen, Check, ChevronRight, Flame, KeyRound, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import HeroFilm from '../components/HeroFilm';
import PastLifeWebtoonPreview from '../components/PastLifeWebtoonPreview';
import {
  PAST_LIFE_NARRATIVE_POLICY,
  PAST_LIFE_PRODUCT,
  pastLifeChapters,
  pastLifeFaq,
  pastLifeQuestions,
  pastLifeSamplePages,
  pastLifeValueItems
} from '../content/pastLifeExperience';
import '../styles/past-life.css';

const startState = { tabOrigin: '/' } as const;

export default function PastLifeLanding() {
  const heroRef = useRef<HTMLElement>(null);
  const [showStickyPurchase, setShowStickyPurchase] = useState(false);

  useEffect(() => {
    const hero = heroRef.current;

    if (!hero || !('IntersectionObserver' in window)) {
      setShowStickyPurchase(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyPurchase(!entry.isIntersecting),
      { threshold: 0.16 }
    );

    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  return (
    <main className="dokkaebi-landing">
      <header className="dokkaebi-site-head">
        <Link to="/" className="dokkaebi-site-brand" aria-label="운월당 홈">
          운월당
        </Link>
        <Link to="/form/past-life-goblin" state={startState} className="dokkaebi-head-action">
          장부 열기
          <ChevronRight size={15} />
        </Link>
      </header>

      <section ref={heroRef} className="dokkaebi-hero" aria-labelledby="dokkaebi-main-title">
        <div className="dokkaebi-hero-copy">
          <span className="dokkaebi-kicker">사주에 남은 오래된 흔적을 깨우는 시간</span>
          <h1 id="dokkaebi-main-title">
            전생을 보러 왔다가,
            <br />
            지금의 나를 이해하게 되는 장부.
          </h1>
          <p>
            내 사주에는 어떤 역할과 관계의 기질이 반복되는지.
            <br />
            그 반복 기질을 상징 서사로 번역해 현생의 연애, 돈, 가족, 직업과 연결합니다.
          </p>

          <div className="dokkaebi-hero-price">
            <small>개인 맞춤 전생장부</small>
            <strong>{PAST_LIFE_PRODUCT.price}</strong>
          </div>

          <div className="dokkaebi-hero-actions">
            <Link to="/form/past-life-goblin" state={startState} className="dokkaebi-primary-action">
              {PAST_LIFE_PRODUCT.primaryAction}
              <ArrowRight size={18} />
            </Link>
            <a href="#past-life-sample" className="dokkaebi-secondary-action">
              {PAST_LIFE_PRODUCT.sampleAction}
            </a>
          </div>

          <p className="dokkaebi-trust-line">상징 캐릭터 · 관계 패턴 · 반복 선택 · 현생 행동 · 30일 퀘스트</p>
        </div>

        <HeroFilm
          src={PAST_LIFE_PRODUCT.film}
          poster={PAST_LIFE_PRODUCT.poster}
          title={PAST_LIFE_PRODUCT.name}
          actionHref="/form/past-life-goblin"
          actionLabel="전생체험 하러가기"
          actionState={startState}
        />
      </section>

      <PastLifeWebtoonPreview />

      <section className="dokkaebi-question-path" aria-labelledby="dokkaebi-question-title">
        <div className="dokkaebi-section-heading">
          <span>장부가 묻는 다섯 가지</span>
          <h2 id="dokkaebi-question-title">기억보다 오래 남은 질문</h2>
          <p>붉은 실은 사랑뿐 아니라 책임, 약속, 미련과 아직 끝내지 못한 선택까지 잇습니다.</p>
        </div>

        <ol className="dokkaebi-question-list">
          {pastLifeQuestions.map((question, index) => (
            <li key={question}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{question}</strong>
            </li>
          ))}
        </ol>
      </section>

      <section className="dokkaebi-ledgers" aria-labelledby="dokkaebi-ledgers-title">
        <div className="dokkaebi-section-heading align-left">
          <span>다섯 권의 흑장부</span>
          <h2 id="dokkaebi-ledgers-title">26개의 주제를 한 편의 상징 서사로 읽습니다</h2>
          <p>정보를 늘어놓지 않고 봉인, 인연, 업, 현생, 해원의 순서로 정리해 끝까지 읽히는 장부로 구성했습니다.</p>
        </div>

        <div className="dokkaebi-ledger-thread" aria-hidden="true" />
        <div className="dokkaebi-ledger-stack">
          {pastLifeChapters.map((chapter, index) => (
            <details key={chapter.id} className={`dokkaebi-ledger chapter-${chapter.id}`} open={index === 0}>
              <summary>
                <span className="dokkaebi-ledger-visual">
                  <img
                    src={chapter.image}
                    alt={chapter.imageAlt}
                    loading="lazy"
                    decoding="async"
                    style={{ objectPosition: chapter.crop }}
                  />
                  <i className="dokkaebi-ledger-flame" aria-hidden="true" />
                  <i className="dokkaebi-ledger-seal" aria-hidden="true">印</i>
                </span>
                <span className="dokkaebi-ledger-copy">
                  <small>{chapter.volume}</small>
                  <strong>{chapter.title}</strong>
                  <em>{chapter.line}</em>
                  <span>{chapter.symbol}</span>
                </span>
                <span className="dokkaebi-ledger-more">
                  더 보기
                  <ChevronRight size={17} />
                </span>
              </summary>
              <div className="dokkaebi-ledger-topics">
                {chapter.topics.map((topic) => (
                  <span key={topic}>{topic}</span>
                ))}
              </div>
            </details>
          ))}
        </div>
      </section>

      <section id="past-life-sample" className="dokkaebi-sample" aria-labelledby="dokkaebi-sample-title">
        <div className="dokkaebi-section-heading align-left">
          <span>샘플 장부</span>
          <h2 id="dokkaebi-sample-title">불을 감춘 기록관</h2>
          <p>실제 고객 결과가 아닌, 리포트의 깊이와 읽는 방식을 보여주는 예시입니다.</p>
        </div>

        <div className="dokkaebi-sample-grid">
          {pastLifeSamplePages.map((page) => (
            <article key={page.number}>
              <span>{page.number}</span>
              <small>샘플</small>
              <h3>{page.title}</h3>
              <strong>{page.label}</strong>
              <p>{page.body}</p>
            </article>
          ))}
        </div>

        <blockquote>
          “상징 서사 속 인물은 남의 이름을 지키느라 자기 이름은 뒤로 미룬 사람으로 그려집니다.”
        </blockquote>
      </section>

      <section className="dokkaebi-value" aria-labelledby="dokkaebi-value-title">
        <div className="dokkaebi-value-intro">
          <span>개인 맞춤 전생장부 · {PAST_LIFE_PRODUCT.price}</span>
          <h2 id="dokkaebi-value-title">장부 한 권이 아니라, 반복 기질의 구조를 받습니다.</h2>
          <p>세계관 장식보다 계산 근거와 현생의 행동이 먼저 남도록 구성했습니다.</p>
        </div>
        <ul>
          {pastLifeValueItems.map((item) => (
            <li key={item}>
              <Check size={16} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="dokkaebi-difference" aria-labelledby="dokkaebi-difference-title">
        <div className="dokkaebi-section-heading">
          <span>전생 이야기만 읽고 끝나지 않습니다</span>
          <h2 id="dokkaebi-difference-title">재미 뒤에 지금의 선택이 남아야 합니다</h2>
        </div>
        <div className="dokkaebi-difference-grid">
          <article className="muted">
            <BookOpen size={20} />
            <h3>이야기만 남는 해석</h3>
            <p>화려한 신분과 비극적인 사건으로 시선을 끌지만, 지금 무엇을 바꿔야 하는지는 남지 않습니다.</p>
          </article>
          <article>
            <ShieldCheck size={20} />
            <h3>현생까지 이어지는 장부</h3>
            <p>사주 구조에서 확인되는 반복 장면을 짚고, 불편한 해석 뒤에 오늘 시작할 행동을 붙입니다.</p>
          </article>
        </div>
      </section>

      <section className="dokkaebi-final-offer" aria-labelledby="dokkaebi-final-title">
        <div className="dokkaebi-final-mark" aria-hidden="true">
          <Flame size={26} />
        </div>
        <span>{PAST_LIFE_PRODUCT.brand}</span>
        <h2 id="dokkaebi-final-title">{PAST_LIFE_PRODUCT.name}</h2>
        <p>
          과거를 증명하는 이야기가 아니라,
          <br />
          지금 반복하는 선택을 바꾸기 위한 상징 장부입니다.
        </p>
        <strong>{PAST_LIFE_PRODUCT.price}</strong>
        <Link to="/form/past-life-goblin" state={startState} className="dokkaebi-primary-action">
          49,000원으로 봉인 해제
          <KeyRound size={18} />
        </Link>
        <small>한 번 결제로 개인 맞춤 장부 전체를 받습니다.</small>
      </section>

      <section className="dokkaebi-faq" aria-labelledby="dokkaebi-faq-title">
        <div className="dokkaebi-section-heading align-left">
          <span>안내</span>
          <h2 id="dokkaebi-faq-title">장부를 열기 전에</h2>
        </div>
        <div className="dokkaebi-faq-list">
          {pastLifeFaq.map((item, index) => (
            <details key={item.question} open={index === 0}>
              <summary>
                <span>{item.question}</span>
                <ChevronRight size={17} />
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
        <p className="dokkaebi-legal-note">
          {PAST_LIFE_NARRATIVE_POLICY.notice}
        </p>
      </section>

      <footer className="dokkaebi-footer">
        <span>운월당 · 케이컴퍼니</span>
        <nav aria-label="법적 안내">
          <Link to="/terms">이용약관</Link>
          <Link to="/privacy">개인정보처리방침</Link>
          <Link to="/refund">환불정책</Link>
        </nav>
      </footer>

      <aside
        className={`dokkaebi-sticky-purchase ${showStickyPurchase ? 'is-visible' : ''}`}
        aria-label="전생사주 구매"
        aria-hidden={!showStickyPurchase}
      >
        <span>
          <small>개인 맞춤 전생장부</small>
          <strong>{PAST_LIFE_PRODUCT.price}</strong>
        </span>
        <Link to="/form/past-life-goblin" state={startState} tabIndex={showStickyPurchase ? undefined : -1}>
          {PAST_LIFE_PRODUCT.primaryAction}
        </Link>
      </aside>
    </main>
  );
}
