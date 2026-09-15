import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  Check,
  ChevronDown,
  CircleSlash2,
  HeartHandshake,
  Link as LinkIcon,
  MessageCircleMore,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { IntakeFormData } from '../../api/mockData';
import type { ReunionContext } from '../../lib/reunion';
import type { SajuReportData } from '../../lib/saju/report';
import { canDiscoverProduct } from '../../products/registry';
import '../../styles/reunion.css';
import ReunionPicture from './ReunionPicture';
import { buildReunionReportPresentation } from './reportPresentation';

type ReunionReportViewProps = {
  report: SajuReportData;
  formData: Partial<IntakeFormData>;
  reunionContext?: ReunionContext | null;
};

const recommendationItems = [
  {
    productId: 'love-reading',
    to: '/detail/love-reading',
    eyebrow: '나의 반복 패턴',
    title: '팩폭 연애운',
    body: '이번 관계와 별개로, 사랑할 때 반복되는 내 선택을 보고 싶다면'
  },
  {
    to: '/guiyeondo',
    eyebrow: '두 사람의 인연 지도',
    title: '귀연도',
    body: '재회 여부보다 두 사람의 연결점과 관계의 모양을 함께 살펴보고 싶다면'
  },
  {
    to: '/detail/general-saju',
    eyebrow: '내 전체 흐름',
    title: '정통 종합사주',
    body: '관계 밖의 일·돈·생활까지 지금의 큰 방향을 함께 점검하고 싶다면'
  }
].filter((item) => !('productId' in item) || canDiscoverProduct(item.productId)) as ReadonlyArray<{ to: string; eyebrow: string; title: string; body: string }>;

function GuideList({ items }: { items: string[] }) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item}>
          <Check size={16} aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function ReunionReportView({
  report,
  formData,
  reunionContext
}: ReunionReportViewProps) {
  const context = useMemo(
    () => reunionContext || formData.reunionContext || null,
    [formData.reunionContext, reunionContext]
  );
  const presentation = useMemo(
    () => buildReunionReportPresentation(report, formData, context),
    [context, formData, report]
  );
  const [shareStatus, setShareStatus] = useState('');
  const { actionGuide, viewModel } = presentation;
  const isEvidenceAvailable = viewModel.deterministicEvidence.length > 0;

  const handleShare = async () => {
    const title = '운월당 재회운';
    const text = '상대의 마음이나 재회 확률을 단정하지 않고, 두 사람의 명리 흐름과 현실적인 연락 조건을 함께 살펴보는 재회운 리포트입니다.';
    const url = typeof window === 'undefined' ? '' : `${window.location.origin}/detail/love-reunion`;

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        setShareStatus('공유 화면을 열었어요.');
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setShareStatus('공유 문구와 링크를 복사했어요.');
      } else {
        setShareStatus('이 브라우저에서는 링크 복사를 지원하지 않아요.');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setShareStatus('공유하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  };

  return (
    <main className="reunion-page reunion-report-page">
      <section className="reunion-report-hero" aria-labelledby="reunion-report-title">
        <ReunionPicture
          image="reunion"
          className="reunion-report-hero-picture"
          alt="붉은 실을 다시 잇기 전 마주 선 두 사람"
          eager
        />
        <div className="reunion-report-hero-shade" aria-hidden="true" />
        <div className="reunion-report-hero-copy">
          <span>운월당 재회운 · 개인 리포트</span>
          <h1 id="reunion-report-title">{presentation.subjectLabel}님,<br />재회보다 먼저 볼 기준이에요</h1>
          <p>{viewModel.headline}</p>
          <small>{report.birthLabel} · {report.serialNumber}</small>
        </div>
      </section>

      <div className="reunion-report-shell">
        <section className="reunion-report-principle" aria-label="리포트 해석 원칙">
          <ShieldCheck size={21} aria-hidden="true" />
          <div>
            <strong>확률이나 속마음을 만들지 않았어요</strong>
            <p>{viewModel.summary}</p>
          </div>
        </section>

        <section className="reunion-report-section" aria-labelledby="reunion-context-title">
          <header className="reunion-report-heading">
            <span>01 · 사용자가 알려준 상황</span>
            <h2 id="reunion-context-title">확인되지 않은 관계 맥락</h2>
            <p>아래 정보는 계산 결과가 아니라 입력한 내용을 정리한 것입니다.</p>
          </header>
          {viewModel.userContext.length ? (
            <dl className="reunion-context-list">
              {viewModel.userContext.map((item) => (
                <div key={item.id}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                  <small>사용자 입력 · 미확인</small>
                </div>
              ))}
            </dl>
          ) : (
            <p className="reunion-empty-state">저장된 이별·연락 상황이 없어 관계 맥락에 대한 판단을 보류합니다.</p>
          )}
        </section>

        <section className="reunion-report-section is-evidence" aria-labelledby="reunion-evidence-title">
          <header className="reunion-report-heading">
            <span>02 · 계산된 명리 근거</span>
            <h2 id="reunion-evidence-title">입력 서술과 분리한 계산 결과</h2>
            <p>재회 여부가 아니라 관계 흐름을 읽을 때 참고한 명식 자료입니다.</p>
          </header>

          <dl className="reunion-saju-fact-grid">
            {presentation.sajuFacts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>

          {isEvidenceAvailable ? (
            <div className="reunion-evidence-list">
              {viewModel.deterministicEvidence.map((item) => (
                <details key={item.id}>
                  <summary>
                    <span>{item.source === 'compatibility' ? '궁합 근거' : '사주 근거'} · {item.label}</span>
                    <ChevronDown size={18} aria-hidden="true" />
                  </summary>
                  <p>{item.statement}</p>
                  <small>검증 범위: {item.confidence === 'supported' ? '계산 근거 확인' : item.confidence === 'limited' ? '제한된 범위에서 참고' : '판단 보류'}</small>
                </details>
              ))}
            </div>
          ) : (
            <div className="reunion-empty-state is-warn">
              <AlertTriangle size={19} aria-hidden="true" />
              <p>전달된 리포트에 추적 가능한 재회·궁합 근거가 없어 관계 해석을 추가로 만들지 않았습니다.</p>
            </div>
          )}
        </section>

        <section className="reunion-report-section is-contact" aria-labelledby="reunion-contact-title">
          <header className="reunion-report-heading">
            <span>03 · 연락 조건과 시기</span>
            <h2 id="reunion-contact-title">{actionGuide.contact.title}</h2>
          </header>
          <div className={`reunion-contact-decision is-${actionGuide.contact.status}`}>
            <MessageCircleMore size={23} aria-hidden="true" />
            <div>
              <strong>{actionGuide.contact.status === 'withheld' ? '연락 보류' : actionGuide.contact.status === 'open' ? '대화 조건 확인' : '조건부 판단'}</strong>
              <p>{actionGuide.contact.timing}</p>
            </div>
          </div>
          <div className="reunion-condition-columns">
            <article>
              <h3><Check size={18} aria-hidden="true" /> 먼저 충족할 조건</h3>
              <GuideList items={actionGuide.contact.conditions} />
            </article>
            <article className="is-prohibited">
              <h3><CircleSlash2 size={18} aria-hidden="true" /> 지금 하지 않을 행동</h3>
              <GuideList items={actionGuide.contact.prohibitedActions} />
            </article>
          </div>
          <aside className="reunion-timing-note">
            <CalendarDays size={19} aria-hidden="true" />
            <div>
              <strong>명리 참고 구간 · {presentation.timingReference.label}</strong>
              <p>{presentation.timingReference.note}</p>
            </div>
          </aside>
        </section>

        <section className="reunion-report-section" aria-labelledby="reunion-actions-title">
          <header className="reunion-report-heading">
            <span>04 · 행동 가이드</span>
            <h2 id="reunion-actions-title">오늘부터 30일까지</h2>
            <p>상대의 반응을 만들기 위한 미션이 아니라, 내 판단을 선명하게 하는 계획입니다.</p>
          </header>
          <div className="reunion-action-timeline">
            {([
              ['오늘', '감정과 사실 분리', actionGuide.today],
              ['7일', '반복되는 행동 관찰', actionGuide.sevenDays],
              ['30일', '관계 방향 결정', actionGuide.thirtyDays]
            ] as const).map(([time, title, items]) => (
              <article key={time}>
                <span>{time}</span>
                <h3>{title}</h3>
                <GuideList items={[...items]} />
              </article>
            ))}
          </div>
        </section>

        <section className="reunion-report-section is-sustain" aria-labelledby="reunion-sustain-title">
          <ReunionPicture
            image="moveOn"
            className="reunion-sustain-picture"
            alt="관계의 다음 방향을 차분하게 선택하는 사람"
          />
          <div className="reunion-sustain-copy">
            <HeartHandshake size={22} aria-hidden="true" />
            <span>05 · 재회 후 지속 조건</span>
            <h2 id="reunion-sustain-title">다시 만나는 것보다<br />다르게 만나는 것이 중요해요</h2>
            <GuideList items={actionGuide.sustainConditions} />
          </div>
        </section>

        <section className="reunion-report-section" aria-labelledby="reunion-limitations-title">
          <header className="reunion-report-heading">
            <span>06 · 해석 한계</span>
            <h2 id="reunion-limitations-title">이 리포트가 말할 수 없는 것</h2>
          </header>
          <div className="reunion-limitations">
            <BookOpenCheck size={22} aria-hidden="true" />
            <GuideList items={viewModel.limitations} />
          </div>
        </section>

        <section className="reunion-report-section reunion-recommendations" aria-labelledby="reunion-recommendations-title">
          <header className="reunion-report-heading">
            <span>07 · 다음에 볼 수 있는 것</span>
            <h2 id="reunion-recommendations-title">질문이 달라졌을 때만 추천해요</h2>
          </header>
          <div className="reunion-recommendation-grid">
            {recommendationItems.map((item) => (
              <Link key={item.to} to={item.to}>
                <small>{item.eyebrow}</small>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
                <span>상품 보기 <ArrowRight size={15} aria-hidden="true" /></span>
              </Link>
            ))}
          </div>
        </section>

        <section className="reunion-report-share" aria-label="리포트 공유">
          <Sparkles size={20} aria-hidden="true" />
          <div>
            <strong>개인정보 없이 재회운 소개를 공유해요</strong>
            <p>두 사람의 이름·생년월일·이별 사유는 공유하지 않습니다.</p>
          </div>
          <button type="button" onClick={handleShare}>
            <LinkIcon size={17} aria-hidden="true" />
            공유하기
          </button>
          <small role="status" aria-live="polite">{shareStatus}</small>
        </section>

        <footer className="reunion-report-disclaimer">
          이 리포트는 전통 명리학 기반 참고 자료입니다. 상대방의 감정·연락·재회를 보장하지 않으며,
          차단이나 명시적 거절이 있으면 모든 접촉보다 상대의 경계와 사용자의 안전을 우선하세요.
        </footer>
      </div>
    </main>
  );
}
