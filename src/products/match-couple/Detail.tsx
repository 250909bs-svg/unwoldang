import {
  ArrowDown,
  ArrowRight,
  CalendarClock,
  Check,
  HeartHandshake,
  ShieldCheck,
  Sparkles,
  UsersRound
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { getProductById } from '../registry';
import coupleCoverAvif from './assets/couple-cover.avif';
import coupleCoverWebp from './assets/couple-cover.webp';
import coupleFrictionAvif from './assets/couple-friction.avif';
import coupleFrictionWebp from './assets/couple-friction.webp';
import coupleRitualAvif from './assets/couple-ritual.avif';
import coupleRitualWebp from './assets/couple-ritual.webp';
import './match-couple.css';

const product = getProductById('match-couple');

type CoupleSceneProps = {
  avif: string;
  webp: string;
  alt: string;
  className: string;
  eager?: boolean;
};

const reportDimensions = [
  '끌림',
  '감정 표현',
  '연락·대화',
  '갈등 회복',
  '생활 습관',
  '소비·재물',
  '장기 관계 역할'
] as const;

const actionMap = ['조심할 말과 행동', '관계 유지 규칙', '개인 질문 2개', '30일 관계 실험'] as const;

function CoupleScene({ avif, webp, alt, className, eager = false }: CoupleSceneProps) {
  const priorityAttribute = eager ? { fetchpriority: 'high' as const } : {};

  return (
    <picture className={`${className}-picture`}>
      <source srcSet={avif} type="image/avif" sizes="(max-width: 860px) 100vw, 860px" />
      <img
        className={className}
        src={webp}
        alt={alt}
        width={941}
        height={1672}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        sizes="(max-width: 860px) 100vw, 860px"
        {...priorityAttribute}
      />
    </picture>
  );
}

function SpeechBubble({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return (
    <div className="match-couple-detail-speech">
      <span className="match-couple-detail-speaker">월연도령 · {eyebrow}</span>
      <p>{children}</p>
    </div>
  );
}

export default function MatchCoupleDetail() {
  const formattedPrice = `${product.price.toLocaleString('ko-KR')}원`;

  return (
    <main className="match-couple-detail-page">
      <a className="match-couple-detail-skip" href="#match-couple-teaser">
        궁합 리포트 구성으로 바로가기
      </a>

      <header className="match-couple-detail-header">
        <Link to="/" className="match-couple-detail-brand" aria-label="운월당 홈으로 이동">
          운월당
        </Link>
        <span aria-label={`${product.displayName} 상품 소개`}>두 사람의 관계 장부</span>
      </header>

      <section className="match-couple-detail-hero" aria-labelledby="match-couple-detail-title">
        <CoupleScene
          avif={coupleCoverAvif}
          webp={coupleCoverWebp}
          className="match-couple-detail-hero-image"
          alt="달빛 아래 서로 다른 방향에서 이어진 붉은 실과 푸른 실을 마주 보는 두 사람"
          eager
        />
        <div className="match-couple-detail-hero-scrim" aria-hidden="true" />
        <div
          className="match-couple-detail-thread match-couple-detail-thread--red"
          data-motion="decorative"
          aria-hidden="true"
        />
        <div
          className="match-couple-detail-thread match-couple-detail-thread--blue"
          data-motion="decorative"
          aria-hidden="true"
        />

        <div className="match-couple-detail-hero-copy">
          <span className="match-couple-detail-act">ACT 00 · 두 실이 만나는 밤</span>
          <p className="match-couple-detail-eyebrow">{product.displayName}</p>
          <h1 id="match-couple-detail-title">
            사랑은 한 줄인데,
            <br />
            왜 우리는 자꾸
            <br />
            엇갈릴까.
          </h1>
          <p className="match-couple-detail-hero-lead">
            한 사람의 운세로 다른 사람을 추측하지 않습니다.
            <br />
            두 명식을 따로 세우고, 관계가 만나는 지점을 함께 읽습니다.
          </p>
          <a className="match-couple-detail-scroll" href="#match-couple-teaser">
            두 사람의 실 따라가기
            <ArrowDown size={18} aria-hidden="true" />
          </a>
          <span className="match-couple-detail-scroll-cue" aria-hidden="true">
            SCROLL TO READ
          </span>
        </div>
      </section>

      <section
        id="match-couple-teaser"
        className="match-couple-detail-teaser"
        aria-labelledby="match-couple-teaser-title"
        tabIndex={-1}
      >
        <h2 id="match-couple-teaser-title" className="match-couple-detail-visually-hidden">
          월연도령이 보여주는 궁합 리포트 미리보기
        </h2>

        <article className="match-couple-detail-panel match-couple-detail-panel--friction">
          <div className="match-couple-detail-panel-art">
            <CoupleScene
              avif={coupleFrictionAvif}
              webp={coupleFrictionWebp}
              className="match-couple-detail-panel-image"
              alt="붉은 실과 푸른 실이 팽팽하게 엇갈린 사이에서 등을 진 두 사람"
            />
            <span className="match-couple-detail-panel-scrim" aria-hidden="true" />
            <span className="match-couple-detail-cut-number" aria-hidden="true">
              CUT 01
            </span>
          </div>
          <div className="match-couple-detail-panel-copy">
            <SpeechBubble eyebrow="첫 번째 장면">
              같은 말인데 한쪽에는 애정이고,
              <br />
              다른 쪽에는 압박일 수 있지.
            </SpeechBubble>
            <h3>둘을 섞기 전에, 각자부터 정확히 봅니다.</h3>
            <div className="match-couple-detail-person-grid" aria-label="두 사람의 개별 계산 항목">
              <section>
                <span
                  className="match-couple-detail-person-mark match-couple-detail-person-mark--red"
                  aria-hidden="true"
                />
                <small>PERSON A · 본인</small>
                <strong>일간 · 오행 · 십신 · 배우자궁</strong>
              </section>
              <section>
                <span
                  className="match-couple-detail-person-mark match-couple-detail-person-mark--blue"
                  aria-hidden="true"
                />
                <small>PERSON B · 상대방</small>
                <strong>일간 · 오행 · 십신 · 배우자궁</strong>
              </section>
            </div>
            <p className="match-couple-detail-panel-note">
              이름 또는 별칭, 성별, 양력·음력과 윤달, 생년월일, 출생시간·지역을 두 사람 각각 입력합니다.
              모르는 시간이나 지역은 ‘미상’으로 남길 수 있고, 계산하지 못한 항목은 결과에 분명히 표시합니다.
            </p>
          </div>
        </article>

        <article className="match-couple-detail-panel match-couple-detail-panel--ritual">
          <div className="match-couple-detail-panel-art">
            <CoupleScene
              avif={coupleRitualAvif}
              webp={coupleRitualWebp}
              className="match-couple-detail-panel-image"
              alt="붉은 실과 푸른 실 사이에 놓인 달빛 관계 장부를 함께 들여다보는 두 사람"
            />
            <span className="match-couple-detail-panel-scrim" aria-hidden="true" />
            <span className="match-couple-detail-cut-number" aria-hidden="true">
              CUT 02
            </span>
          </div>
          <div className="match-couple-detail-panel-copy">
            <SpeechBubble eyebrow="두 번째 장면">
              좋다, 나쁘다로 끝내지 않아.
              <br />
              어디서 당기고 어디서 풀리는지 볼 거야.
            </SpeechBubble>
            <h3>두 명식이 만날 때 생기는 관계의 힘을 펼칩니다.</h3>
            <div className="match-couple-detail-relation-row" aria-label="명리 관계 분석 항목">
              {['합', '충', '형', '파', '해'].map((relation) => (
                <span key={relation}>{relation}</span>
              ))}
            </div>
            <p className="match-couple-detail-panel-note">
              관계 상태와 기간, 주요 갈등, 알고 싶은 점을 함께 받아 명리 근거와 현실의 맥락을 연결합니다.
              궁합 점수는 만들지 않으며, 상대의 마음을 사실처럼 단정하지 않습니다.
            </p>
          </div>
        </article>
      </section>

      <section className="match-couple-detail-map" aria-labelledby="match-couple-map-title">
        <header className="match-couple-detail-section-heading">
          <span className="match-couple-detail-act">ACT 03 · 관계 장부의 순서</span>
          <Sparkles size={22} aria-hidden="true" />
          <h2 id="match-couple-map-title">
            운명 판정이 아니라,
            <br />
            같이 살아갈 방법을 찾는 순서.
          </h2>
          <p>계산 가능한 근거부터 관계에서 바로 확인할 행동까지, 세 겹으로 읽힙니다.</p>
        </header>

        <ol className="match-couple-detail-map-list">
          <li>
            <span>01</span>
            <div>
              <small>각자의 명식</small>
              <h3>두 사람을 별도로 계산</h3>
              <p>일간·오행·십신·배우자궁을 각각 확인하고, 시간 미상으로 달라질 수 있는 근거는 제외합니다.</p>
            </div>
            <UsersRound size={23} aria-hidden="true" />
          </li>
          <li>
            <span>02</span>
            <div>
              <small>관계의 일곱 장면</small>
              <h3>생활 속 궁합을 7차원으로 비교</h3>
              <ul className="match-couple-detail-dimension-grid" aria-label="관계 궁합 7차원">
                {reportDimensions.map((dimension) => (
                  <li key={dimension}>{dimension}</li>
                ))}
              </ul>
            </div>
            <HeartHandshake size={23} aria-hidden="true" />
          </li>
          <li>
            <span>03</span>
            <div>
              <small>현실에서 써보는 답</small>
              <h3>읽고 끝나지 않는 관계 사용법</h3>
              <ul className="match-couple-detail-action-grid">
                {actionMap.map((item) => (
                  <li key={item}>
                    <Check size={15} aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <CalendarClock size={23} aria-hidden="true" />
          </li>
        </ol>
      </section>

      <section className="match-couple-detail-trust" aria-labelledby="match-couple-trust-title">
        <div className="match-couple-detail-trust-seal" aria-hidden="true">
          <ShieldCheck size={29} />
        </div>
        <div>
          <span className="match-couple-detail-act">월연도령의 원칙</span>
          <h2 id="match-couple-trust-title">모르는 건 아는 척하지 않습니다.</h2>
          <p>
            출생시간 미상으로 시주를 계산할 수 없거나 날짜 경계가 달라질 수 있으면 해당 근거와 해석을 보류합니다.
            두 사람의 차이를 서열이나 무작위 숫자로 바꾸지 않습니다.
          </p>
        </div>
      </section>

      <section className="match-couple-detail-offer" aria-labelledby="match-couple-offer-title">
        <div className="match-couple-detail-offer-threads" aria-hidden="true">
          <span className="match-couple-detail-offer-thread match-couple-detail-offer-thread--red" />
          <span className="match-couple-detail-offer-thread match-couple-detail-offer-thread--blue" />
        </div>
        <span className="match-couple-detail-act">ACT 04 · 두 사람의 장부 열기</span>
        <p>두 명식의 근거와 관계 맥락을 함께 읽는 독립 궁합 리포트</p>
        <h2 id="match-couple-offer-title">{product.displayName}</h2>
        <strong className="match-couple-detail-price" aria-label={`상품 가격 ${formattedPrice}`}>
          {formattedPrice}
        </strong>
        <Link
          className="match-couple-detail-cta"
          to={product.routes.intake}
          state={{ tabOrigin: product.routes.detail }}
        >
          두 사람 궁합 장부 열기
          <ArrowRight size={19} aria-hidden="true" />
        </Link>
        <small>
          가짜 할인이나 마감 압박 없이 표시된 가격으로 결제되며, 완성된 리포트는 보관함에서 다시 볼 수 있어요.
        </small>
      </section>
    </main>
  );
}
