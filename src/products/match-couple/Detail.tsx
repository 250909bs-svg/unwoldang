import {
  ArrowRight,
  CalendarClock,
  Check,
  HeartHandshake,
  Scale,
  ShieldCheck,
  UsersRound
} from 'lucide-react';
import { Link } from 'react-router-dom';
import MobileTopBar from '../../components/MobileTopBar';
import { getProductById } from '../registry';
import './match-couple.css';

const product = getProductById('match-couple');

const intakeGroups = [
  {
    title: '두 사람의 기본 정보',
    body: '본인과 상대방 각각의 이름 또는 별칭, 성별, 양력·음력과 윤달, 생년월일을 입력합니다.'
  },
  {
    title: '시간·지역의 확인 범위',
    body: '각자의 출생시간과 출생지역을 입력하거나, 기억나지 않는 항목은 미상으로 남길 수 있습니다.'
  },
  {
    title: '지금 관계의 맥락',
    body: '관계 상태와 관계 기간, 주요 갈등, 알고 싶은 점을 적어 현재 두 사람에게 필요한 비교 기준을 정합니다.'
  },
  {
    title: '개인 질문 2개',
    body: '궁합 결과에서 따로 답을 받고 싶은 질문 두 가지를 입력합니다.'
  }
] as const;

const reportGroups = [
  {
    title: '각자의 명식',
    items: ['일간과 오행', '십신의 관계 방식', '배우자궁의 특징']
  },
  {
    title: '두 명식의 상호작용',
    items: ['합·충·형·파·해', '끌림과 감정 표현', '연락·대화와 갈등 회복']
  },
  {
    title: '함께 사는 현실',
    items: ['생활 습관', '소비·재물 기준', '장기 관계의 역할 배치']
  },
  {
    title: '관계를 위한 실행안',
    items: ['조심할 말과 행동', '관계 유지 규칙', '질문 2개 답변과 30일 관계 실험']
  }
] as const;

function StartLink({ label }: { label: string }) {
  return (
    <Link
      className="match-couple-detail-cta"
      to={product.routes.intake}
      state={{ tabOrigin: product.routes.detail }}
    >
      {label}
      <ArrowRight size={18} aria-hidden="true" />
    </Link>
  );
}

export default function MatchCoupleDetail() {
  const formattedPrice = `${product.price.toLocaleString('ko-KR')}원`;

  return (
    <main className="mobile-page-shell match-couple-detail-page">
      <div className="mobile-page-card match-couple-detail-card">
        <MobileTopBar title="운월당" backTo="/" backLabel="홈" />

        <div className="match-couple-detail-content">
          <section className="match-couple-detail-hero" aria-labelledby="match-couple-detail-title">
            <div className="match-couple-detail-hero-copy">
              <span className="match-couple-detail-eyebrow">TWO-PERSON COMPARISON</span>
              <p className="match-couple-detail-kicker">두 사람 비교형 독립 궁합</p>
              <h1 id="match-couple-detail-title">{product.displayName}</h1>
              <p className="match-couple-detail-lead">
                한 사람의 연애운에 상대를 덧붙이지 않습니다. 두 사람의 명식을 각각 계산한 뒤,
                서로를 만났을 때 생기는 끌림과 마찰, 생활의 합을 같은 기준으로 비교합니다.
              </p>
              <div className="match-couple-detail-price-row" aria-label={`상품 가격 ${formattedPrice}`}>
                <strong>{formattedPrice}</strong>
                <span>두 사람 맞춤 리포트</span>
              </div>
              <StartLink label="두 사람 궁합 시작하기" />
            </div>

            <div className="match-couple-detail-hero-visual" aria-hidden="true">
              <img src={product.home.image} alt="" />
              <span className="match-couple-detail-orbit orbit-one" />
              <span className="match-couple-detail-orbit orbit-two" />
              <div className="match-couple-detail-seal">
                <UsersRound size={24} />
                <strong>각자 계산</strong>
                <span>근거로 비교</span>
              </div>
            </div>
          </section>

          <section className="match-couple-detail-section" aria-labelledby="match-couple-intake-title">
            <div className="match-couple-detail-heading">
              <span><CalendarClock size={18} aria-hidden="true" /> INPUT</span>
              <h2 id="match-couple-intake-title">두 사람을 따로, 관계는 함께 입력합니다</h2>
              <p>계산에 필요한 출생정보와 실제 관계의 맥락을 분리해 받습니다.</p>
            </div>
            <div className="match-couple-detail-input-grid">
              {intakeGroups.map((group, index) => (
                <article key={group.title} className="match-couple-detail-input-card">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <h3>{group.title}</h3>
                  <p>{group.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="match-couple-detail-section soft" aria-labelledby="match-couple-report-title">
            <div className="match-couple-detail-heading">
              <span><HeartHandshake size={18} aria-hidden="true" /> REPORT</span>
              <h2 id="match-couple-report-title">점수 대신 관계가 작동하는 방식을 보여드립니다</h2>
              <p>좋다·나쁘다 한 줄이 아니라, 계산 근거와 현실의 운영 기준을 함께 정리합니다.</p>
            </div>
            <div className="match-couple-detail-report-grid">
              {reportGroups.map((group) => (
                <article key={group.title} className="match-couple-detail-report-card">
                  <h3>{group.title}</h3>
                  <ul>
                    {group.items.map((item) => (
                      <li key={item}>
                        <Check size={15} aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section className="match-couple-detail-principles" aria-labelledby="match-couple-principles-title">
            <div className="match-couple-detail-heading">
              <span><Scale size={18} aria-hidden="true" /> METHOD</span>
              <h2 id="match-couple-principles-title">확인할 수 있는 만큼만 해석합니다</h2>
            </div>
            <div className="match-couple-detail-principle-grid">
              <article>
                <Scale size={21} aria-hidden="true" />
                <h3>자의적인 궁합 점수 없음</h3>
                <p>
                  근거 없는 숫자나 무작위 점수를 만들지 않습니다. 일간·오행·십신·배우자궁과
                  합충형파해의 확인된 근거를 정성적으로 설명합니다.
                </p>
              </article>
              <article>
                <CalendarClock size={21} aria-hidden="true" />
                <h3>시간·지역 미상은 명확히 표시</h3>
                <p>
                  출생시간 미상은 시주와 시주 의존 항목을 계산에서 제외하고, 계산하지 못한 항목으로 표시합니다.
                  출생지역 미상은 지역 보정을 적용하지 않았다고 안내합니다.
                </p>
              </article>
              <article>
                <ShieldCheck size={21} aria-hidden="true" />
                <h3>공유보다 개인정보가 먼저</h3>
                <p>
                  생년월일·출생시간·출생지역과 질문 원문은 공유용 요약에 기본 노출하지 않습니다.
                  상대방은 이름 대신 별칭으로 입력할 수 있습니다.
                </p>
              </article>
            </div>
          </section>

          <section className="match-couple-detail-final" aria-labelledby="match-couple-final-title">
            <UsersRound size={27} aria-hidden="true" />
            <div>
              <span>월연도령의 관계 장부</span>
              <h2 id="match-couple-final-title">맞는 사람인지보다, 어떻게 맞춰갈 수 있는지 확인하세요</h2>
              <p>두 사람의 차이를 판단표가 아닌 대화와 생활의 규칙으로 바꿔드립니다.</p>
            </div>
            <StartLink label={`${formattedPrice} · 궁합 시작하기`} />
          </section>
        </div>
      </div>
    </main>
  );
}
