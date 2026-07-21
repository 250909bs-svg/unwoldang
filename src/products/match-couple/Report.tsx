import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, Check, Copy, Home, Share2, Users } from 'lucide-react';
import type { IntakeFormData } from '../../api/mockData';
import { clearPendingPayment, readStoredAuthUser } from '../../lib/auth';
import { evaluateReportAccess, type ReportAccessMode } from '../../lib/reportAccessGate';
import { saveRemoteReportArchiveEntry, saveReportArchiveEntry } from '../../lib/reportArchive';
import { buildSajuReport } from '../../lib/saju/reportBuilder';
import type { SajuReportData } from '../../lib/saju/report';
import { canReadHistoricalReport, getProductById } from '../registry';
import ProductUnavailable from '../components/ProductUnavailable';
import { buildMatchCoupleReportModel } from './analysis';
import { createMatchCoupleShareData } from './share';
import { isMatchCoupleReportModel } from './modelValidation';
import type { MatchCoupleReportModel, MatchCoupleStoredFormData } from './types';
import './match-couple.css';

type MatchCoupleReportData = SajuReportData & {
  matchCoupleModel?: unknown;
};

export function createArchivedMatchCoupleReport(
  canonicalReport: MatchCoupleReportData | null,
  model: MatchCoupleReportModel | null
) {
  if (!canonicalReport || !model) return canonicalReport;
  const archivedModel: MatchCoupleReportModel = {
    ...model,
    context: {
      ...model.context,
      majorConflict: '',
      desiredInsight: '',
      questions: ['', '']
    }
  };

  return {
    ...canonicalReport,
    birthLabel: '',
    questionPreview: '',
    metaGrid: [],
    sections: [],
    questionAnswers: model.guidance === null
      ? []
      : canonicalReport.questionAnswers.map((answer, index) => ({
          ...answer,
          question: model.questions[index] || answer.question
        })),
    matchCoupleModel: archivedModel
  } satisfies MatchCoupleReportData;
}

export function canBuildMatchCoupleModel(mode: ReportAccessMode, usesPreviewData: boolean) {
  return usesPreviewData || mode === 'new-generation';
}


type MatchCoupleReportLocationState = {
  formData?: Partial<MatchCoupleStoredFormData>;
  paymentMethod?: string;
  orderId?: string;
  reportAccessToken?: string;
  reportData?: MatchCoupleReportData;
  reportProvider?: 'gemini' | 'deterministic-fallback';
};

const tendencyLabels = {
  supportive: '보완 근거 우세',
  conditional: '조건부 조율',
  tension: '적극 조율 필요',
  insufficient: '판정 유보'
} as const;

function renderList(items: string[], empty: string) {
  return items.length ? items.map((item) => <li key={item}>{item}</li>) : <li>{empty}</li>;
}

export default function MatchCoupleReport() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state as MatchCoupleReportLocationState | null) || {};
  const product = getProductById('match-couple');
  const [shareMessage, setShareMessage] = useState('');
  const reportAccess = evaluateReportAccess({
    hostname: typeof window === 'undefined' ? '' : window.location.hostname,
    isDevelopment: import.meta.env.DEV,
    expectedServiceId: 'match-couple',
    orderId: state.orderId,
    reportAccessToken: state.reportAccessToken,
    reportData: state.reportData
  });

  const canonicalReport = useMemo<MatchCoupleReportData | null>(() => {
    if (state.reportData) return state.reportData;
    if (!reportAccess.usesPreviewData || !state.formData?.birthDate) return null;
    return buildSajuReport('match-couple', state.formData as Partial<IntakeFormData>);
  }, [reportAccess.usesPreviewData, state.formData, state.reportData]);

  const model = useMemo(() => {
    if (isMatchCoupleReportModel(canonicalReport?.matchCoupleModel)) {
      return canonicalReport.matchCoupleModel;
    }
    if (!canBuildMatchCoupleModel(reportAccess.mode, reportAccess.usesPreviewData)) {
      return null;
    }
    if (!state.formData?.birthDate || !state.formData.partner?.birthDate) return null;
    try {
      return buildMatchCoupleReportModel(state.formData);
    } catch {
      return null;
    }
  }, [
    canonicalReport?.matchCoupleModel,
    reportAccess.mode,
    reportAccess.usesPreviewData,
    state.formData
  ]);

  const archivedReport = useMemo(
    () => createArchivedMatchCoupleReport(canonicalReport, model),
    [canonicalReport, model]
  );

  useEffect(() => {
    document.title = '월연도령 사주궁합 리포트 | 운월당';
  }, []);

  useEffect(() => {
    if (!reportAccess.canRender && canReadHistoricalReport(product.id)) {
      navigate(product.routes.intake, { replace: true });
    }
  }, [navigate, product.id, product.routes.intake, reportAccess.canRender]);

  useEffect(() => {
    if (!reportAccess.canArchive || !state.orderId || !archivedReport || !model) {
      return;
    }

    const authUser = readStoredAuthUser();
    const archiveEntry = {
      id: `match-couple:${state.orderId}`,
      orderId: state.orderId,
      productId: 'match-couple' as const,
      customerName: model.names[0],
      title: product.displayName,
      subtitle: `${model.names[0]}님과 ${model.names[1]}님의 두 사람 비교 리포트`,
      createdAt: archivedReport.createdAt,
      paymentMethod: state.paymentMethod,
      reportData: archivedReport,
      reportProvider: state.reportProvider
    };

    saveReportArchiveEntry(archiveEntry, authUser?.id);
    if (authUser?.authToken && state.reportAccessToken) {
      void saveRemoteReportArchiveEntry(archiveEntry, {
        authToken: authUser.authToken,
        reportAccessToken: state.reportAccessToken
      });
    }
    clearPendingPayment();
  }, [
    archivedReport,
    model,
    product.displayName,
    reportAccess.canArchive,
    state.orderId,
    state.paymentMethod,
    state.reportAccessToken,
    state.reportProvider
  ]);

  const handleShare = async () => {
    if (!model) return;
    const data = createMatchCoupleShareData(model, window.location.origin);
    try {
      if (navigator.share) {
        await navigator.share(data);
        setShareMessage('상품 링크를 공유했습니다.');
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${data.text}\n${data.url}`);
        setShareMessage('개인정보를 제외한 상품 링크를 복사했습니다.');
      } else {
        setShareMessage(`공유 링크: ${data.url}`);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setShareMessage('공유하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  };

  if (!canReadHistoricalReport(product.id)) {
    return <ProductUnavailable product={product} />;
  }

  if (!reportAccess.canRender) {
    return (
      <main className="match-couple-page match-couple-report-page">
        <section className="match-couple-state-card" role="status">
          <BookOpen aria-hidden="true" />
          <h1>결제한 리포트에서 열어주세요</h1>
          <p>리포트는 주문과 상품에 묶인 서버 권한을 확인한 뒤에만 표시됩니다.</p>
          <Link to={product.routes.intake}>궁합 입력으로 돌아가기</Link>
        </section>
      </main>
    );
  }

  if (!canonicalReport || !model) {
    return (
      <main className="match-couple-page match-couple-report-page">
        <section className="match-couple-state-card" role="alert">
          <BookOpen aria-hidden="true" />
          <h1>두 사람의 입력을 다시 확인해 주세요</h1>
          <p>이 보관 리포트에는 전용 비교 분석에 필요한 두 사람의 입력 기록이 없습니다.</p>
          <Link to={product.routes.intake}>궁합 다시 입력하기</Link>
        </section>
      </main>
    );
  }

  const answers = model.guidance === null ? [] : canonicalReport.questionAnswers.slice(0, 2);

  return (
    <main className="match-couple-page match-couple-report-page">
      <nav className="match-couple-topbar" aria-label="리포트 메뉴">
        <Link to="/my" aria-label="마이페이지로 돌아가기"><ArrowLeft size={18} /> 내 보관함</Link>
        <span>월연도령 · 사주궁합</span>
        <Link to="/" aria-label="홈으로"><Home size={18} /></Link>
      </nav>

      <header className="match-couple-report-hero">
        <span className="match-couple-eyebrow">TWO CHARTS · ONE RELATIONSHIP</span>
        <Users aria-hidden="true" />
        <h1>{model.names[0]} <i>×</i> {model.names[1]}</h1>
        <p>{model.relationshipSummary}</p>
        <div className={`match-couple-tendency ${model.overview?.tendency || 'insufficient'}`}>
          {tendencyLabels[model.overview?.tendency || 'insufficient']}
        </div>
        <p className="match-couple-report-lead">
          {model.overview?.statement || '입력 시나리오에서 일주가 달라져 단일 궁합 결론을 유보했습니다.'}
        </p>
        <button type="button" className="match-couple-share-button" onClick={() => void handleShare()}>
          <Share2 size={17} /> 개인정보 없이 상품 공유
        </button>
        {shareMessage ? <small role="status">{shareMessage}</small> : null}
      </header>

      {model.limitations.length ? (
        <section className="match-couple-limitations" aria-labelledby="match-limitations-title">
          <h2 id="match-limitations-title">계산에서 제외하거나 유보한 항목</h2>
          <ul>{renderList(model.limitations, '추가 제한사항이 없습니다.')}</ul>
        </section>
      ) : null}

      <section className="match-couple-report-section" aria-labelledby="match-profiles-title">
        <div className="match-couple-section-heading">
          <span>01 · 두 사람 원국</span>
          <h2 id="match-profiles-title">각자의 일간·오행·십신·배우자궁</h2>
        </div>
        <div className="match-couple-profile-grid">
          {model.people.map((person, index) => (
            <article className="match-couple-profile-card" key={index === 0 ? 'self' : 'partner'}>
              {person ? (
                <>
                  <span>{index === 0 ? '본인' : '상대방'}</span>
                  <h3>{person.name}</h3>
                  <div className="match-couple-day-master">
                    <strong>{person.dayMaster}</strong>
                    <p>{person.dayMasterElement} 일간</p>
                  </div>
                  <dl>
                    <div><dt>사주 원국</dt><dd>{[person.pillars.year, person.pillars.month, person.pillars.day, person.pillars.hour || '시주 미상'].join(' · ')}</dd></div>
                    <div><dt>배우자궁</dt><dd>{person.spousePalace.branch} · {person.spousePalace.element} · {person.spousePalace.tenGod}</dd></div>
                  </dl>
                  <div className="match-couple-fact-block">
                    <h4>오행 분포</h4>
                    <ul>{person.fiveElements.map((item) => <li key={item.label}><span>{item.label}</span><b>{item.weight}</b></li>)}</ul>
                  </div>
                  <div className="match-couple-fact-block">
                    <h4>십신 분포</h4>
                    <ul>{person.tenGods.filter((item) => item.weight > 0).map((item) => <li key={item.label}><span>{item.label}</span><b>{item.weight}</b></li>)}</ul>
                  </div>
                  {person.availability.status !== 'available' ? <p className="match-couple-fact-note">{person.availability.note}</p> : null}
                </>
              ) : (
                <>
                  <span>{index === 0 ? '본인' : '상대방'}</span>
                  <h3>단일 원국 계산 유보</h3>
                  <p>시간 미상 시나리오에서 핵심 기둥이 달라져 임의 시각을 고르지 않았습니다.</p>
                </>
              )}
            </article>
          ))}
        </div>
        <p className="match-couple-data-note">숫자는 원국 안의 결정론적 분포값이며 궁합 점수나 관계 성공 확률이 아닙니다.</p>
      </section>

      <section className="match-couple-report-section" aria-labelledby="match-relations-title">
        <div className="match-couple-section-heading">
          <span>02 · 교차 관계</span>
          <h2 id="match-relations-title">합·충·형·파·해를 겹침까지 그대로</h2>
        </div>
        <div className="match-couple-relations-grid">
          {model.relations.map((group) => (
            <article key={group.id}>
              <strong>{group.label}</strong>
              <span>{group.items.length ? `${group.items.length}개 근거` : '직접 근거 없음'}</span>
              {group.items.map((item) => (
                <details key={item.id}>
                  <summary>{item.subtype || item.name}</summary>
                  <p>{item.description}</p>
                  {item.uncertainty.length ? <small>{item.uncertainty.join(' ')}</small> : null}
                </details>
              ))}
            </article>
          ))}
        </div>
        <p className="match-couple-data-note">합이 탐지돼도 합화 성립을 자동 확정하지 않으며, 관계 개수로 우열을 매기지 않습니다.</p>
      </section>

      {model.guidance ? (
        <section className="match-couple-report-section" aria-labelledby="match-guidance-title">
          <div className="match-couple-section-heading">
            <span>03 · 관계 운영</span>
            <h2 id="match-guidance-title">끌림부터 장기 역할까지</h2>
          </div>
          <div className="match-couple-guidance-grid">
            {Object.values(model.guidance).map((item) => (
              <article key={item.id} className={`tone-${item.tendency}`}>
                <span>{tendencyLabels[item.tendency]}</span>
                <h3>{item.label}</h3>
                <p>{item.statement}</p>
                <strong>{item.practicalRule}</strong>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="match-couple-report-section match-couple-cautions" aria-labelledby="match-cautions-title">
        <div className="match-couple-section-heading">
          <span>04 · 갈등 안전장치</span>
          <h2 id="match-cautions-title">조심할 말과 행동</h2>
        </div>
        <div className="match-couple-two-column">
          <article><h3>피할 말</h3><ul>{renderList(model.cautionWords, '단정 대신 확인 질문을 사용하세요.')}</ul></article>
          <article><h3>피할 행동</h3><ul>{renderList(model.cautionActions, '합의 없는 결정을 피하세요.')}</ul></article>
        </div>
      </section>

      <section className="match-couple-report-section" aria-labelledby="match-rules-title">
        <div className="match-couple-section-heading">
          <span>05 · 유지 규칙</span>
          <h2 id="match-rules-title">둘 사이에 남겨둘 약속</h2>
        </div>
        <ol className="match-couple-rule-list">
          {model.relationshipRules.map((rule) => <li key={rule}><Check size={17} /><span>{rule}</span></li>)}
        </ol>
      </section>

      <section className="match-couple-report-section" aria-labelledby="match-questions-title">
        <div className="match-couple-section-heading">
          <span>06 · 맞춤 답변</span>
          <h2 id="match-questions-title">두 가지 질문</h2>
        </div>
        <div className="match-couple-question-grid">
          {model.questions.map((question, index) => {
            const answer = answers[index];
            return (
              <article key={`${index}-${question}`}>
                <span>QUESTION {index + 1}</span>
                <h3>{question}</h3>
                <p>{answer?.analysis || '이 질문의 생성형 해설을 확인할 수 없어 결정론 근거만 제공합니다.'}</p>
                {answer?.advice?.length ? <ul>{answer.advice.map((advice) => <li key={advice}>{advice}</li>)}</ul> : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className="match-couple-report-section" aria-labelledby="match-experiment-title">
        <div className="match-couple-section-heading">
          <span>07 · 30일 관계 실험</span>
          <h2 id="match-experiment-title">예측 대신 함께 확인하는 한 달</h2>
        </div>
        <div className="match-couple-experiment-grid">
          {model.experiment.map((item) => (
            <article key={item.days}>
              <span>{item.days}</span>
              <h3>{item.title}</h3>
              <p>{item.action}</p>
              <small>{item.check}</small>
            </article>
          ))}
        </div>
      </section>

      <footer className="match-couple-report-footer">
        <Copy aria-hidden="true" />
        <p>이 리포트는 전통 명리학의 구조적 상호작용을 설명하는 참고 자료이며 상대의 마음이나 관계 결과를 확정하지 않습니다.</p>
        <div><Link to="/my">보관함에서 다시 보기</Link><Link to={product.routes.detail}>상품 상세 보기</Link></div>
      </footer>
    </main>
  );
}
