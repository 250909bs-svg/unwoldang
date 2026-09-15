import {
  ArrowRight,
  CalendarClock,
  Check,
  HeartHandshake,
  MessageCircleMore,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';
import ReunionPicture from './ReunionPicture';
import { REUNION_PATHS, REUNION_PRICE } from './reunionFlow';
import '../../styles/reunion.css';

const reportContents = [
  '두 사람의 명식에서 확인되는 관계 리듬',
  '연락을 시도해도 되는 현실 조건',
  '지금 피해야 할 연락과 행동',
  '오늘·7일·30일 행동 가이드',
  '재회 뒤 같은 이별을 막는 지속 조건'
] as const;

const standards = [
  {
    icon: CalendarClock,
    title: '시기보다 조건을 먼저',
    body: '좋다는 날짜 하나를 찍기보다, 연락해도 되는 신호와 멈춰야 할 신호를 함께 봅니다.'
  },
  {
    icon: MessageCircleMore,
    title: '마음 대신 행동을 확인',
    body: '상대의 속마음을 사실처럼 단정하지 않고, 실제 응답과 경계 표현을 판단 기준으로 둡니다.'
  },
  {
    icon: ShieldCheck,
    title: '재회와 정리를 모두 존중',
    body: '다시 만나는 것만 정답으로 몰지 않고, 나를 지키며 멈춰야 하는 경우도 분명히 안내합니다.'
  }
] as const;

export default function ReunionLanding() {
  return (
    <main className="reunion-page reunion-landing">
      <header className="reunion-topbar">
        <Link to="/" className="reunion-wordmark" aria-label="운월당 홈으로 이동">
          <span aria-hidden="true">緣</span>
          <strong>운월당</strong>
        </Link>
        <Link to={REUNION_PATHS.intake} className="reunion-topbar-link">
          바로 시작
        </Link>
      </header>

      <section className="reunion-hero" aria-labelledby="reunion-hero-title">
        <ReunionPicture
          image="hero"
          className="reunion-hero-picture"
          alt="붉은 실을 사이에 두고 서로를 바라보는 두 사람"
          eager
        />
        <div className="reunion-hero-shade" aria-hidden="true" />
        <div className="reunion-hero-copy">
          <p className="reunion-eyebrow">운월당 · 재회운</p>
          <h1 id="reunion-hero-title">
            다시 연락해도 될까,
            <br />
            이제는 멈춰야 할까
          </h1>
          <p>
            두 사람의 명리 흐름과 지금의 연락 상황을 나눠 보고,
            기대가 아닌 행동 기준으로 다음 한 걸음을 정리해 드려요.
          </p>
          <Link to={REUNION_PATHS.intake} className="reunion-primary-cta">
            <span>
              <small>첫 공개가</small>
              <strong>{REUNION_PRICE.toLocaleString('ko-KR')}원으로 재회 흐름 보기</strong>
            </span>
            <ArrowRight size={20} aria-hidden="true" />
          </Link>
          <span className="reunion-hero-note">약 3분 입력 · 결제 전 미리보기 제공</span>
        </div>
      </section>

      <section className="reunion-section reunion-intro" aria-labelledby="reunion-intro-title">
        <div className="reunion-section-heading">
          <span>01 · 기대와 사실 사이</span>
          <h2 id="reunion-intro-title">보고 싶은 답보다<br />확인할 수 있는 신호를 봐요</h2>
          <p>
            이별 뒤에는 작은 반응도 크게 읽히기 쉬워요. 운월당은 사용자가 알려준 상황과
            명식에서 계산한 근거를 섞지 않고 보여드립니다.
          </p>
        </div>
        <ReunionPicture
          image="reflection"
          className="reunion-editorial-picture"
          alt="창가에 앉아 관계를 돌아보는 사람"
        />
      </section>

      <section className="reunion-section reunion-contents" aria-labelledby="reunion-contents-title">
        <div className="reunion-section-heading is-centered">
          <span>02 · 리포트 구성</span>
          <h2 id="reunion-contents-title">결과에서 바로 확인하는 것</h2>
        </div>
        <div className="reunion-contents-layout">
          <ReunionPicture
            image="contact"
            className="reunion-editorial-picture"
            alt="휴대전화를 앞에 두고 연락을 고민하는 사람"
          />
          <ol className="reunion-report-list">
            {reportContents.map((item, index) => (
              <li key={item}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{item}</strong>
                <Check size={18} aria-hidden="true" />
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="reunion-section reunion-standards" aria-labelledby="reunion-standards-title">
        <div className="reunion-section-heading is-centered">
          <span>03 · 해석 원칙</span>
          <h2 id="reunion-standards-title">재회를 확률로 단정하지 않아요</h2>
          <p>관계는 두 사람의 선택으로 움직입니다. 사주는 그 선택을 점검하는 참고 근거로 사용합니다.</p>
        </div>
        <div className="reunion-standard-grid">
          {standards.map(({ icon: Icon, title, body }) => (
            <article key={title}>
              <Icon size={22} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="reunion-section reunion-two-paths" aria-labelledby="reunion-paths-title">
        <div className="reunion-path-visuals" aria-hidden="true">
          <ReunionPicture image="reunion" className="reunion-path-picture" alt="" />
          <ReunionPicture image="moveOn" className="reunion-path-picture" alt="" />
        </div>
        <div className="reunion-path-copy">
          <Sparkles size={22} aria-hidden="true" />
          <h2 id="reunion-paths-title">다시 이어져도,<br />각자의 길을 가도</h2>
          <p>
            결과의 목적은 상대를 붙잡게 하는 것이 아니라, 지금의 내가 후회가 적은 선택을 하도록 돕는 것입니다.
          </p>
          <div className="reunion-safety-note">
            <HeartHandshake size={20} aria-hidden="true" />
            <span>차단·연락 거절·위협이 있는 관계에서는 접촉보다 안전과 경계를 우선합니다.</span>
          </div>
        </div>
      </section>

      <section className="reunion-final-cta" aria-labelledby="reunion-final-title">
        <span>지금 필요한 건 한 번 더 추측하는 일이 아니라</span>
        <h2 id="reunion-final-title">내가 확인할 기준을 갖는 일</h2>
        <Link to={REUNION_PATHS.intake} className="reunion-primary-cta is-light">
          <span>
            <small>두 사람의 정보로</small>
            <strong>{REUNION_PRICE.toLocaleString('ko-KR')}원 재회운 시작하기</strong>
          </span>
          <ArrowRight size={20} aria-hidden="true" />
        </Link>
        <p>
          본 콘텐츠는 전통 명리학 기반의 참고 자료이며 상대방의 연락, 감정 또는 재회를 보장하지 않습니다.
        </p>
      </section>
    </main>
  );
}
