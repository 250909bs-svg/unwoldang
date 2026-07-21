import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CircleDollarSign,
  Compass,
  HeartHandshake,
  Orbit,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { findServiceById } from '../api/mockData';
import {
  GENERAL_SIGNATURE_DETAIL_PATH,
  GENERAL_SIGNATURE_FORM_PATH,
  GENERAL_SIGNATURE_ID,
  GENERAL_SIGNATURE_PRODUCT,
  GENERAL_SIGNATURE_SEO
} from '../products/general-signature';
import '../styles/general-saju.css';

const SERVICE_ID = GENERAL_SIGNATURE_ID;
const FORM_PATH = GENERAL_SIGNATURE_FORM_PATH;
const seoContent = GENERAL_SIGNATURE_SEO;
const formState = { tabOrigin: GENERAL_SIGNATURE_DETAIL_PATH } as const;

const detailCopy = GENERAL_SIGNATURE_PRODUCT.detail;
const { readingAreas, reportFlow, reportChapters } = detailCopy;
const readingAreaIcons = {
  sparkles: Sparkles,
  orbit: Orbit,
  book: BookOpen,
  relations: HeartHandshake,
  career: BriefcaseBusiness,
  money: CircleDollarSign,
  love: HeartHandshake,
  timing: Orbit,
  questions: Compass
} as const;

export default function GeneralSajuLanding() {
  const service = findServiceById(SERVICE_ID);

  return (
    <main className="general-saju-page">
      <header className="general-saju-header">
        <Link to="/" className="general-saju-brand" aria-label="운월당 홈으로 이동">
          운월당
        </Link>
        <nav aria-label="종합사주 페이지 이동">
          <a href="#general-method">분석 방식</a>
          <a href="#general-faq">자주 묻는 질문</a>
          <Link to={FORM_PATH} state={formState} className="general-saju-header-cta">
            내 사주 보기
          </Link>
        </nav>
      </header>

      <section className="general-saju-hero" aria-labelledby="general-saju-title">
        <div className="general-saju-hero-copy">
          <span className="general-saju-eyebrow">{GENERAL_SIGNATURE_PRODUCT.detail.eyebrow}</span>
          <h1 id="general-saju-title">
            {detailCopy.hero.titleLines[0]}
            <br />
            {detailCopy.hero.titleLines[1]}
          </h1>
          <p>{detailCopy.hero.description}</p>
          <div className="general-saju-hero-actions">
            <Link to={FORM_PATH} state={formState} className="general-saju-primary-cta">
              내 종합사주 시작하기
              <ArrowRight size={19} aria-hidden="true" />
            </Link>
            <a href="#general-preview" className="general-saju-secondary-cta">
              리포트 구성 먼저 보기
            </a>
          </div>
          <ul className="general-saju-trust-list" aria-label="종합사주 핵심 특징">
            {detailCopy.hero.trustItems.map((item) => (
              <li key={item}>
                <Check size={15} aria-hidden="true" /> {item}
              </li>
            ))}
          </ul>
        </div>

        <figure className="general-saju-hero-art">
          <picture>
            <source srcSet="/home-general-saju-card.avif" type="image/avif" />
            <source srcSet="/home-general-saju-card.webp" type="image/webp" />
            <img
              src="/home-general-saju-card.png"
              alt="푸른 밤의 명리 상담 공간에서 종합사주 장부를 펼치는 장면"
              width="992"
              height="1586"
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
          </picture>
          <figcaption>
            <span>개인 맞춤 종합사주</span>
            <strong>{service.price}</strong>
          </figcaption>
        </figure>
      </section>

      <section className="general-saju-definition" aria-labelledby="general-definition-title">
        <div>
          <span className="general-saju-section-label">종합사주란?</span>
          <h2 id="general-definition-title">{detailCopy.definition.title}</h2>
        </div>
        <p>{detailCopy.definition.body}</p>
      </section>

      <section className="general-saju-areas" aria-labelledby="general-areas-title">
        <div className="general-saju-section-heading">
          <span className="general-saju-section-label">{detailCopy.areasIntro.label}</span>
          <h2 id="general-areas-title">{detailCopy.areasIntro.title}</h2>
          <p>{detailCopy.areasIntro.body}</p>
        </div>
        <div className="general-saju-area-grid">
          {readingAreas.map((area) => {
            const Icon = readingAreaIcons[area.icon];
            return (
              <article key={area.title}>
                <span aria-hidden="true">
                  <Icon size={22} />
                </span>
                <h3>{area.title}</h3>
                <p>{area.copy}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="general-method" className="general-saju-method" aria-labelledby="general-method-title">
        <div className="general-saju-section-heading align-left">
          <span className="general-saju-section-label">HOW IT WORKS</span>
          <h2 id="general-method-title">{detailCopy.methodIntro.title}</h2>
          <p>{detailCopy.methodIntro.body}</p>
        </div>
        <ol className="general-saju-method-list">
          {reportFlow.map((step) => (
            <li key={step.number}>
              <span>{step.number}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </div>
            </li>
          ))}
        </ol>
        <aside className="general-saju-safety-note">
          <ShieldCheck size={23} aria-hidden="true" />
          <p>{detailCopy.safetyNote}</p>
        </aside>
      </section>

      <section id="general-preview" className="general-saju-preview" aria-labelledby="general-preview-title">
        <div className="general-saju-preview-card">
          <header>
            <BookOpen size={25} aria-hidden="true" />
            <div>
              <span>SAMPLE CONTENTS</span>
              <h2 id="general-preview-title">{detailCopy.preview.title}</h2>
            </div>
          </header>
          <ol>
            {reportChapters.map((chapter, index) => (
              <li key={chapter}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{chapter}</strong>
              </li>
            ))}
          </ol>
          <p>{detailCopy.preview.disclaimer}</p>
        </div>
        <div className="general-saju-preview-copy">
          <span className="general-saju-section-label">읽고 끝나지 않는 리포트</span>
          <h2>{detailCopy.preview.principleTitle}</h2>
          <p>{detailCopy.preview.principleBody}</p>
          <Link to={FORM_PATH} state={formState}>
            내 질문으로 시작하기
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="general-saju-seo-content" aria-labelledby="general-depth-title">
        <div className="general-saju-section-heading align-left">
          <span className="general-saju-section-label">종합사주를 깊게 읽는 기준</span>
          <h2 id="general-depth-title">무료 만세력 표를 실제 선택으로 바꾸는 네 가지 해석</h2>
        </div>
        <div>
          {seoContent.sections.map((section) => (
            <article key={section.heading}>
              <h3>{section.heading}</h3>
              <p>{section.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="general-saju-offer" aria-labelledby="general-offer-title">
        <span>운월당 대표 리포트</span>
        <h2 id="general-offer-title">{GENERAL_SIGNATURE_PRODUCT.displayName}</h2>
        <p>{detailCopy.offer.body}</p>
        <strong>{service.price}</strong>
        <ul>
          {service.output.map((item) => (
            <li key={item}>
              <Check size={16} aria-hidden="true" /> {item}
            </li>
          ))}
        </ul>
        <Link to={FORM_PATH} state={formState}>
          내 종합사주 입력하기
          <ArrowRight size={19} aria-hidden="true" />
        </Link>
      </section>

      <section id="general-faq" className="general-saju-faq" aria-labelledby="general-faq-title">
        <div className="general-saju-section-heading align-left">
          <span className="general-saju-section-label">FAQ</span>
          <h2 id="general-faq-title">종합사주를 시작하기 전에</h2>
        </div>
        <div>
          {seoContent.faqs.map((item, index) => (
            <details key={item.question} open={index === 0}>
              <summary>
                <span>{item.question}</span>
                <ChevronRight size={18} aria-hidden="true" />
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <nav className="general-saju-related" aria-label="운월당 대표 사주 리포트">
        <div>
          <span>이야기로 보는 반복 기질</span>
          <Link to="/detail/past-life-goblin">
            MZ 도깨비 전생사주
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
        <div>
          <span>관계에 집중한 팩폭 분석</span>
          <Link to="/detail/love-reading">
            MZ무당 팩폭 연애운
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </nav>

      <footer className="general-saju-footer">
        <Link to="/">운월당</Link>
        <nav aria-label="법적 안내">
          <Link to="/terms">이용약관</Link>
          <Link to="/privacy">개인정보처리방침</Link>
          <Link to="/refund">환불정책</Link>
        </nav>
      </footer>
    </main>
  );
}
