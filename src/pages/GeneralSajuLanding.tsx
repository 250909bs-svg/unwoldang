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
import seoRouteData from '../content/seoRoutes.json';
import '../styles/general-saju.css';

const SERVICE_ID = 'general-signature';
const FORM_PATH = `/form/${SERVICE_ID}`;
const seoContent = seoRouteData['/detail/general-saju'];
const formState = { tabOrigin: '/detail/general-saju' } as const;

const readingAreas = [
  {
    title: '타고난 기질과 강점',
    copy: '일간과 월령, 오행과 십성의 배치를 함께 읽어 내가 자연스럽게 잘하는 방식과 쉽게 지치는 조건을 구분합니다.',
    icon: Sparkles
  },
  {
    title: '직업과 일의 구조',
    copy: '직업 이름 하나를 찍기보다 성과가 붙는 역할, 조직과 독립 중 맞는 환경, 이직·확장 전에 확인할 조건을 정리합니다.',
    icon: BriefcaseBusiness
  },
  {
    title: '재물과 선택 습관',
    copy: '돈이 들어오는 방식과 새는 패턴, 가격·정산·소비에서 반복되는 장면을 재성과 식상의 흐름에 연결해 설명합니다.',
    icon: CircleDollarSign
  },
  {
    title: '연애와 인간관계',
    copy: '좋아하는 사람 앞에서 달라지는 태도, 편한 관계와 소모되는 관계의 차이, 내가 먼저 지켜야 할 경계를 살핍니다.',
    icon: HeartHandshake
  },
  {
    title: '대운·세운의 현재 흐름',
    copy: '평생을 고정된 운명으로 보지 않고 지금의 대운과 세운이 원국의 어느 부분을 크게 움직이는지 확인합니다.',
    icon: Orbit
  },
  {
    title: '질문 두 가지 맞춤 해설',
    copy: '고객이 실제로 고민하는 질문을 판정 근거와 연결하고 오늘, 30일, 90일 순서로 실행할 행동을 정리합니다.',
    icon: Compass
  }
] as const;

const reportFlow = [
  {
    number: '01',
    title: '명식 계산',
    copy: '양력·음력, 출생지와 시간을 확인해 연주·월주·일주·시주와 대운 시작점을 계산합니다.'
  },
  {
    number: '02',
    title: '근거 교차 확인',
    copy: '월령, 오행, 십성, 합충형파와 현재 운에서 같은 방향을 가리키는 신호를 먼저 고정합니다.'
  },
  {
    number: '03',
    title: '생활 장면으로 해석',
    copy: '명리 용어를 일·돈·관계에서 실제로 겪는 장면과 선택 기준으로 바꿉니다.'
  },
  {
    number: '04',
    title: '검증 후 리포트 제공',
    copy: '문장과 근거 ID가 일치하는지 서버에서 확인한 뒤 모바일에서 다시 볼 수 있는 결과로 제공합니다.'
  }
] as const;

const reportChapters = [
  '나를 가장 정확히 설명하는 세 가지 기질',
  '강점이 성과로 바뀌는 일의 방식',
  '재물 흐름과 돈이 새기 쉬운 장면',
  '연애·가족·인간관계의 반복 패턴',
  '현재 대운과 가까운 세운의 우선순위',
  '질문 두 가지에 대한 결론과 행동 순서'
] as const;

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
          <span className="general-saju-eyebrow">운월당 대표 리포트 · 정밀 종합사주 풀이</span>
          <h1 id="general-saju-title">
            종합사주 풀이:
            <br />
            타고난 성향부터 지금의 대운까지
          </h1>
          <p>
            원국·월령·오행·십성에서 시작해 직업, 재물, 연애와 현재 대운을 하나의 흐름으로 연결합니다.
            명리 근거와 현실 행동을 함께 확인하는 개인 맞춤 종합사주 리포트입니다.
          </p>
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
            <li>
              <Check size={15} aria-hidden="true" /> 만세력 코드 계산
            </li>
            <li>
              <Check size={15} aria-hidden="true" /> 명리 근거 표시
            </li>
            <li>
              <Check size={15} aria-hidden="true" /> 결과 저장·다시보기
            </li>
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
          <h2 id="general-definition-title">인생을 한 줄로 단정하지 않고, 여러 근거를 함께 읽는 분석</h2>
        </div>
        <p>
          사주팔자는 태어난 네 기둥을 계산하는 출발점입니다. 운월당은 한 글자나 신살 하나로 결과를 정하지 않습니다.
          월령과 일간의 관계, 오행과 십성의 분포, 합충형파, 현재 대운과 세운이 같은 방향을 가리키는지 교차 확인한
          뒤 고객의 일과 관계에서 이해할 수 있는 문장으로 풀어냅니다.
        </p>
      </section>

      <section className="general-saju-areas" aria-labelledby="general-areas-title">
        <div className="general-saju-section-heading">
          <span className="general-saju-section-label">한 번에 확인하는 여섯 영역</span>
          <h2 id="general-areas-title">성향부터 대운까지 따로 놀지 않게 연결합니다</h2>
          <p>좋은 운과 나쁜 운을 세는 대신, 어떤 조건에서 강점이 살아나고 무엇을 먼저 조정해야 하는지 확인합니다.</p>
        </div>
        <div className="general-saju-area-grid">
          {readingAreas.map((area) => {
            const Icon = area.icon;
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
          <h2 id="general-method-title">사주 계산과 설명 문장을 분리해 검증합니다</h2>
          <p>
            자동 생성 문장이 명식을 바꾸지 못하도록 계산, 판정, 표현과 검증의 단계를 나눕니다. 결과에는 확인 가능한
            근거를 붙이고 단정할 수 없는 내용은 조건과 가능성으로 표시합니다.
          </p>
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
          <p>
            질병·수명·사고를 예언하거나 타인의 마음을 사실처럼 만들지 않습니다. 명리 해석은 선택을 돕는 참고 자료이며
            의료·법률·재정 판단을 대신하지 않습니다.
          </p>
        </aside>
      </section>

      <section id="general-preview" className="general-saju-preview" aria-labelledby="general-preview-title">
        <div className="general-saju-preview-card">
          <header>
            <BookOpen size={25} aria-hidden="true" />
            <div>
              <span>SAMPLE CONTENTS</span>
              <h2 id="general-preview-title">내 결과에서 열리는 종합사주 목차</h2>
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
          <p>실제 문장과 우선순위는 입력한 명식, 현재 상황과 질문에 따라 달라집니다.</p>
        </div>
        <div className="general-saju-preview-copy">
          <span className="general-saju-section-label">읽고 끝나지 않는 리포트</span>
          <h2>결론 → 근거 → 다른 가능성 → 행동 순서로 읽힙니다</h2>
          <p>
            어려운 명리 용어만 길게 늘어놓지 않습니다. 먼저 핵심을 말하고 왜 그렇게 읽었는지, 반대로 나타날 가능성은
            무엇인지, 현실에서 무엇을 확인하면 되는지 순서대로 설명합니다.
          </p>
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
        <h2 id="general-offer-title">운월선생 정통 종합사주</h2>
        <p>성향·직업·재물·연애·대운과 질문 두 가지를 하나의 개인 리포트로 정리합니다.</p>
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
