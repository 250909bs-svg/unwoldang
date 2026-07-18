import { ArrowLeft, ArrowRight, Check, ChevronRight, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import HeroFilm from '../components/HeroFilm';
import { PAST_LIFE_PRODUCT } from '../content/pastLifeExperience';
import seoRouteData from '../content/seoRoutes.json';
import '../styles/past-life.css';

const startState = { tabOrigin: '/' } as const;
const seoContent = seoRouteData['/detail/past-life-goblin'];

export default function PastLifeEntry() {
  return (
    <main className="dokkaebi-entry-page" aria-label="MZ 도깨비 전생사주 입장">
      <header className="dokkaebi-entry-head">
        <Link to="/" className="dokkaebi-entry-back" aria-label="홈으로 돌아가기">
          <ArrowLeft size={22} aria-hidden="true" />
        </Link>
        <Link to="/" className="dokkaebi-entry-brand" aria-label="운월당 홈">
          운월당
        </Link>
        <span className="dokkaebi-entry-head-spacer" aria-hidden="true" />
      </header>

      <HeroFilm
        src={PAST_LIFE_PRODUCT.film}
        poster={PAST_LIFE_PRODUCT.poster}
        title={PAST_LIFE_PRODUCT.name}
        actionHref="/detail/past-life-goblin/immersion"
        actionLabel="전생체험 하러가기"
        actionState={startState}
        variant="entry"
      />

      <article className="dokkaebi-entry-seo" aria-labelledby="dokkaebi-entry-seo-title">
        <header className="dokkaebi-entry-seo-hero">
          <span>MZ 도깨비 전생사주 · 웹툰형 전생장부</span>
          <h1 id="dokkaebi-entry-seo-title">전생의 나와 인연, 현생에 남은 반복을 읽는 봉인록</h1>
          <p>{seoContent.intro}</p>
          <p className="dokkaebi-entry-seo-price">
            <span>개인 맞춤 전생장부</span>
            <strong>{PAST_LIFE_PRODUCT.price}</strong>
          </p>
          <div>
            <Link to="/detail/past-life-goblin/immersion" state={startState}>
              전생체험 하러가기
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <a href="#dokkaebi-entry-method">분석 방식 보기</a>
          </div>
          <ul aria-label="도깨비 전생사주 구성">
            {seoContent.highlights.map((item) => (
              <li key={item}>
                <Check size={15} aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </header>

        <section id="dokkaebi-entry-method" className="dokkaebi-entry-seo-method" aria-labelledby="dokkaebi-method-title">
          <div>
            <span>전생사주를 만드는 기준</span>
            <h2 id="dokkaebi-method-title">이야기보다 먼저, 명리의 반복 신호를 고정합니다</h2>
            <p>
              전생을 확인된 역사로 단정하지 않습니다. 계산된 명식에서 여러 근거가 반복해서 가리키는 기질을 먼저 찾고,
              그 의미를 전생의 정체·인연·업·현생·해원의 순서로 번역합니다.
            </p>
          </div>
          <aside>
            <ShieldCheck size={24} aria-hidden="true" />
            <p>
              인물 이미지는 명리 해석과 서사의 분위기를 시각화한 창작 장면입니다. 실제 역사 인물을 확인하거나
              초자연적 사실을 증명하는 콘텐츠가 아닙니다.
            </p>
          </aside>
        </section>

        <section className="dokkaebi-entry-seo-grid" aria-label="도깨비 전생사주 상세 설명">
          {seoContent.sections.map((section, index) => (
            <article key={section.heading}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h2>{section.heading}</h2>
              <p>{section.body}</p>
            </article>
          ))}
        </section>

        <section className="dokkaebi-entry-seo-faq" aria-labelledby="dokkaebi-entry-faq-title">
          <header>
            <span>FAQ</span>
            <h2 id="dokkaebi-entry-faq-title">전생 장부를 열기 전에</h2>
          </header>
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

        <nav className="dokkaebi-entry-related" aria-label="운월당 대표 사주 리포트">
          <Link to="/detail/love-reading">
            <span>반복되는 관계에 집중한다면</span>
            <strong>
              MZ무당 팩폭 연애운 <ArrowRight size={17} aria-hidden="true" />
            </strong>
          </Link>
          <Link to="/detail/general-saju">
            <span>일·돈·관계 전체를 함께 본다면</span>
            <strong>
              운월선생 정통 종합사주 <ArrowRight size={17} aria-hidden="true" />
            </strong>
          </Link>
        </nav>

        <footer className="dokkaebi-entry-seo-footer">
          <Link to="/">운월당</Link>
          <nav aria-label="법적 안내">
            <Link to="/terms">이용약관</Link>
            <Link to="/privacy">개인정보처리방침</Link>
            <Link to="/refund">환불정책</Link>
          </nav>
        </footer>
      </article>
    </main>
  );
}
