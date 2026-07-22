import {
  ArrowRight,
  Check,
  ChevronLeft,
  Clock3,
  HeartHandshake,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UserRound
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { loveReunionProduct } from './index';
import './detail.css';

const reportTopics = [
  {
    title: '현재 관계 상태',
    body: '지금 두 사람 사이의 거리와 실제로 확인된 관계 상황부터 정리합니다.'
  },
  {
    title: '나의 반복 패턴',
    body: '불안할 때 되풀이하는 연락·거리 두기·확인 행동을 돌아봅니다.'
  },
  {
    title: '두 사람의 감정 속도',
    body: '감정을 표현하고 관계를 회복하는 속도의 차이를 조건부로 비교합니다.'
  },
  {
    title: '연결에 유리·불리한 신호',
    body: '말이 아닌 약속, 답변, 경계 존중처럼 현실에서 확인할 신호를 나눕니다.'
  },
  {
    title: '연락 가능한 조건과 금지 조건',
    body: '대화를 작게 열 수 있는 조건과 연락을 멈춰야 할 조건을 함께 제시합니다.'
  },
  {
    title: '참고할 시기',
    body: '정확한 날짜 예언이 아닌, 사주 흐름상 움직임과 정리에 참고할 구간을 살핍니다.'
  },
  {
    title: '재접촉 체크리스트와 문장 원칙',
    body: '보내기 전 확인할 항목과 압박·심문을 줄이는 첫 문장 원칙을 정리합니다.'
  },
  {
    title: '재회 후 유지 조건',
    body: '다시 만남보다 중요한 연락, 책임, 갈등 회복 방식의 변화를 확인합니다.'
  },
  {
    title: '재회하지 않을 경우 회복 방향',
    body: '관계를 놓는 선택도 실패로 보지 않고, 감정과 생활을 회복할 다음 행동을 찾습니다.'
  },
  {
    title: '질문 2개',
    body: '사용자가 직접 적은 두 가지 질문을 각각 분리해 현실적인 조건으로 답합니다.'
  },
  {
    title: '30일 행동 계획',
    body: '연락 전 점검부터 관계 판단 또는 회복까지 4주 단위로 실행 순서를 제안합니다.'
  }
] as const;

const inputGroups = [
  {
    icon: UserRound,
    label: '본인 정보',
    title: '내 사주 흐름의 기준',
    body: '생년월일시, 시간 미상, 음력·윤달 여부를 입력합니다.'
  },
  {
    icon: HeartHandshake,
    label: '선택 입력',
    title: '상대방 출생 정보',
    body: '알고 있다면 생년월일시를 더할 수 있습니다. 몰라도 그대로 진행할 수 있습니다.'
  },
  {
    icon: MessageCircle,
    label: '관계 맥락',
    title: '헤어진 뒤 실제 상황',
    body: '관계 상태, 교제 기간, 이별 후 경과, 마지막 연락, 현재 연락 여부, 이별 이유와 재회 이유를 적습니다.'
  },
  {
    icon: Sparkles,
    label: '맞춤 질문',
    title: '가장 궁금한 질문 2개',
    body: '상대의 마음을 대신 단정하는 질문보다, 내가 확인하고 선택할 수 있는 질문을 권합니다.'
  }
] as const;

const evidenceGroups = [
  {
    number: '01',
    title: '사주 흐름',
    body: '원국과 대운·세운에서 읽히는 감정 표현, 관계 회복, 거리 조절의 경향'
  },
  {
    number: '02',
    title: '사용자 입력',
    body: '교제와 이별 과정, 마지막 연락처럼 사용자가 직접 알려준 관계의 사실'
  },
  {
    number: '03',
    title: '현실 행동 신호',
    body: '답변, 약속, 책임, 경계 존중처럼 관계 밖에서도 확인할 수 있는 반복 행동'
  }
] as const;

const startState = { tabOrigin: loveReunionProduct.routes.detail } as const;

export default function LoveReunionDetail() {
  const formattedPrice = `${loveReunionProduct.price.toLocaleString('ko-KR')}원`;

  return (
    <main className="love-reunion-detail-page">
      <div className="love-reunion-detail-shell">
        <nav className="love-reunion-detail-nav" aria-label="재회운 상세 페이지 탐색">
          <Link className="love-reunion-detail-back" to="/" aria-label="운월당 홈으로 돌아가기">
            <ChevronLeft size={19} aria-hidden="true" />
            <span>운월당</span>
          </Link>
          <span className="love-reunion-detail-nav-label">LOVE · REUNION</span>
        </nav>

        <section className="love-reunion-detail-hero" aria-labelledby="love-reunion-detail-title">
          <div className="love-reunion-detail-hero-copy">
            <div className="love-reunion-detail-eyebrow">
              <Sparkles size={15} aria-hidden="true" />
              <span>홍연아씨의 조건형 재회 리포트</span>
            </div>
            <h1 id="love-reunion-detail-title">{loveReunionProduct.displayName}</h1>
            <p className="love-reunion-detail-lead">
              다시 만날 수 있는지를 단정하기보다, 지금 연락해도 되는 조건과 같은 이별을 반복하지 않을 기준을 먼저 봅니다.
            </p>

            <div className="love-reunion-detail-hero-meta" aria-label="상품 핵심 정보">
              <span>
                <Clock3 size={16} aria-hidden="true" />
                입력부터 30일 계획까지
              </span>
              <span>
                <ShieldCheck size={16} aria-hidden="true" />
                조건과 현실 신호 중심
              </span>
            </div>

            <div className="love-reunion-detail-purchase">
              <div>
                <span>개인 맞춤 리포트</span>
                <strong>{formattedPrice}</strong>
              </div>
              <Link
                className="love-reunion-detail-primary-link"
                to={loveReunionProduct.routes.intake}
                state={startState}
              >
                재회운 시작하기
                <ArrowRight size={19} aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="love-reunion-detail-poster" aria-label="홍연아씨 재회운 상품 이미지">
            <img
              src={loveReunionProduct.home.image}
              alt="홍연아씨 재회운"
              width={992}
              height={1586}
            />
            <div className="love-reunion-detail-poster-shade" aria-hidden="true" />
            <div className="love-reunion-detail-poster-caption">
              <span>REUNION LETTER</span>
              <strong>미련과 가능성 사이,<br />확인할 조건부터.</strong>
            </div>
          </div>
        </section>

        <section className="love-reunion-detail-intro" aria-labelledby="love-reunion-detail-intro-title">
          <span className="love-reunion-detail-section-kicker">BEFORE THE ANSWER</span>
          <h2 id="love-reunion-detail-intro-title">연락이 올까요, 보다 먼저 볼 것</h2>
          <p>
            재회는 한 사람의 마음이나 좋은 시기만으로 결정되지 않습니다. 두 사람이 헤어진 이유가 달라졌는지,
            대화를 다시 열 안전한 조건이 있는지, 재회 뒤 관계를 유지할 행동 변화가 있는지를 함께 확인합니다.
          </p>
          <blockquote>
            “다시 이어질 가능성”과 “다시 이어져도 괜찮은 관계”는 같은 질문이 아닙니다.
          </blockquote>
        </section>

        <section className="love-reunion-detail-section" aria-labelledby="love-reunion-detail-report-title">
          <header className="love-reunion-detail-section-head">
            <div>
              <span className="love-reunion-detail-section-kicker">REPORT · 11 CHAPTERS</span>
              <h2 id="love-reunion-detail-report-title">리포트에서 확인할 11가지</h2>
            </div>
            <p>가능성 하나로 끝내지 않고, 연락 전·재회 후·회복까지 한 흐름으로 정리합니다.</p>
          </header>

          <ol className="love-reunion-detail-report-grid">
            {reportTopics.map((topic, index) => (
              <li key={topic.title} className="love-reunion-detail-report-card">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{topic.title}</h3>
                  <p>{topic.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="love-reunion-detail-section love-reunion-detail-input-section" aria-labelledby="love-reunion-detail-input-title">
          <header className="love-reunion-detail-section-head">
            <div>
              <span className="love-reunion-detail-section-kicker">YOUR CONTEXT</span>
              <h2 id="love-reunion-detail-input-title">이 내용을 먼저 들려주세요</h2>
            </div>
            <p>상대방 생년월일시를 몰라도 본인 정보와 관계 맥락만으로 진행할 수 있습니다.</p>
          </header>

          <div className="love-reunion-detail-input-grid">
            {inputGroups.map(({ icon: Icon, label, title, body }) => (
              <article key={title} className="love-reunion-detail-input-card">
                <div className="love-reunion-detail-input-icon" aria-hidden="true">
                  <Icon size={21} />
                </div>
                <span>{label}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="love-reunion-detail-evidence" aria-labelledby="love-reunion-detail-evidence-title">
          <div className="love-reunion-detail-evidence-copy">
            <span className="love-reunion-detail-section-kicker">READING STANDARD</span>
            <h2 id="love-reunion-detail-evidence-title">세 가지를 섞지 않고 읽습니다</h2>
            <p>
              사주에서 보이는 경향, 사용자가 알려준 사실, 현실에서 확인할 행동을 구분해야 과한 기대나 불안을 줄일 수 있습니다.
            </p>
          </div>

          <div className="love-reunion-detail-evidence-list">
            {evidenceGroups.map((group) => (
              <article key={group.number} className="love-reunion-detail-evidence-card">
                <span>{group.number}</span>
                <div>
                  <h3>{group.title}</h3>
                  <p>{group.body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="love-reunion-detail-expectation" aria-labelledby="love-reunion-detail-expectation-title">
          <header className="love-reunion-detail-section-head">
            <div>
              <span className="love-reunion-detail-section-kicker">BEFORE PURCHASE</span>
              <h2 id="love-reunion-detail-expectation-title">결제 전에 결과 범위를 확인하세요</h2>
            </div>
            <p>재회 성공을 보장하는 답이 아니라, 입력한 사실과 사주 흐름을 구분해 판단 조건과 행동 계획을 제공하는 리포트입니다.</p>
          </header>

          <div className="love-reunion-detail-expectation-grid">
            <article>
              <span>입력</span>
              <strong>5단계 · 결제 전 검토</strong>
              <p>상대방 출생정보는 선택이며, 결제 전 전체 입력을 다시 확인하고 수정할 수 있습니다.</p>
            </article>
            <article>
              <span>생성</span>
              <strong>분석 완료 후 자동 이동</strong>
              <p>네트워크와 분석 상태에 따라 달라질 수 있으며, 응답이 지연되면 화면에서 다시 시도하도록 안내합니다.</p>
            </article>
            <article>
              <span>보관·삭제</span>
              <strong>최대 1년 보관</strong>
              <p>마이페이지 다시보기를 지원하며, 법령상 보관 의무를 제외하고 삭제를 요청할 수 있습니다.</p>
            </article>
          </div>

          <div className="love-reunion-detail-result-preview" aria-label="결과 구성 미리보기">
            <span>RESULT STRUCTURE · 실제 결과 데이터 없음</span>
            <ul>
              <li><span>01</span><strong>현재 판단</strong><small>근거 구분과 연락 경계</small></li>
              <li><span>02</span><strong>질문별 답변</strong><small>입력한 질문 원문 기준</small></li>
              <li><span>03</span><strong>30일 계획</strong><small>연락 또는 회복 행동 순서</small></li>
            </ul>
            <p>위 화면은 결과의 구성만 보여줍니다. 개인별 해석 문장과 판단은 입력 및 결제 후 생성됩니다.</p>
          </div>

          <p className="love-reunion-detail-policy-links">
            자세한 기준은 <Link to="/privacy">개인정보처리방침</Link>과 <Link to="/refund">환불정책</Link>에서 확인할 수 있습니다.
          </p>
        </section>

        <aside className="love-reunion-detail-safety" aria-labelledby="love-reunion-detail-safety-title">
          <ShieldCheck size={28} aria-hidden="true" />
          <div>
            <span>SAFE READING</span>
            <h2 id="love-reunion-detail-safety-title">상대의 속마음과 미래를 대신 확정하지 않습니다</h2>
            <p>
              상대가 반드시 연락한다고 말하거나 정확한 연락 날짜와 재회 성공을 보장하지 않습니다. 참고할 사주 흐름은 조건으로,
              관계 판단은 실제 답변·약속·행동 변화로 확인하도록 안내합니다.
            </p>
          </div>
        </aside>

        <section className="love-reunion-detail-final" aria-labelledby="love-reunion-detail-final-title">
          <div>
            <span className="love-reunion-detail-section-kicker">START WITH FACTS</span>
            <h2 id="love-reunion-detail-final-title">붙잡을지 놓을지, 불안이 아닌 기준으로</h2>
            <p>입력한 관계 맥락과 사주 흐름을 함께 보고, 오늘 할 수 있는 행동부터 차분히 정리합니다.</p>
          </div>
          <div className="love-reunion-detail-final-action">
            <span>결제 전 상품 금액</span>
            <strong>{formattedPrice}</strong>
            <Link
              className="love-reunion-detail-primary-link"
              to={loveReunionProduct.routes.intake}
              state={startState}
            >
              내 재회운 입력하기
              <ArrowRight size={19} aria-hidden="true" />
            </Link>
            <small>
              <Check size={14} aria-hidden="true" />
              상대방 출생 정보를 몰라도 진행 가능
            </small>
          </div>
        </section>
      </div>
      <div className="love-reunion-detail-mobile-cta" aria-label="재회운 구매 시작">
        <div>
          <span>개인 맞춤 리포트</span>
          <strong>{formattedPrice}</strong>
        </div>
        <Link to={loveReunionProduct.routes.intake} state={startState}>
          입력하기 <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>
    </main>
  );
}
