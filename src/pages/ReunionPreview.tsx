import {
  ArrowLeft,
  ArrowRight,
  Check,
  LockKeyhole,
  ShieldAlert,
  Sparkles
} from 'lucide-react';
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  isReunionIntakeReady,
  readReunionDraft,
  saveReunionDraft
} from '../lib/reunion/intake';
import { buildReunionReport, findReunionMetric } from '../lib/reunion/reportEngine';
import type { ReunionIntakeData } from '../lib/reunion/types';
import { isLocalReportPreviewAllowed } from '../lib/reportAccessGate';
import '../styles/reunion.css';

type LocationState = {
  formData?: ReunionIntakeData;
  tabOrigin?: string;
  recoveredEntitlement?: {
    orderId: string;
    reportAccessToken: string;
  };
};

export default function ReunionPreview() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const state = (location.state as LocationState | null) || null;
  const formData = state?.formData || readReunionDraft();
  const tabOrigin = state?.tabOrigin || '/detail/love-reunion';
  const ready = Boolean(formData && isReunionIntakeReady(formData));
  const result = useMemo(() => {
    if (!formData || !ready) return null;
    try {
      return { report: buildReunionReport(formData), error: '' };
    } catch (error) {
      return {
        report: null,
        error: error instanceof Error ? error.message : '재회운 계산을 완료하지 못했습니다.'
      };
    }
  }, [formData, ready]);
  const canOpenLocal =
    typeof window !== 'undefined' &&
    isLocalReportPreviewAllowed(window.location.hostname, import.meta.env.DEV);

  const edit = () => navigate('/form/love-reunion', {
    state: { formData, tabOrigin }
  });

  const unlock = () => {
    if (!formData) return;
    if (result?.report?.safety.status === 'ANALYSIS_BLOCKED') return;
    if (canOpenLocal) {
      navigate('/report/love-reunion', {
        state: { formData, paymentMethod: 'local-preview' }
      });
      return;
    }
    saveReunionDraft(formData);
    if (!isAuthenticated) {
      navigate('/login', {
        state: { returnTo: '/preview/love-reunion', tabOrigin }
      });
      return;
    }
    if (state?.recoveredEntitlement) {
      navigate('/loading', {
        state: {
          product: 'love-reunion',
          formData,
          paymentMethod: 'portone',
          orderId: state.recoveredEntitlement.orderId,
          reportAccessToken: state.recoveredEntitlement.reportAccessToken,
          tabOrigin
        }
      });
      return;
    }
    navigate('/checkout', {
      state: {
        product: 'love-reunion',
        formData,
        tabOrigin,
        draftOwnerId: user?.id
      }
    });
  };

  if (!formData || !ready || !result?.report) {
    return (
      <main className="reunion-preview reunion-preview--error">
        <section>
          <span>입력 확인이 필요해요</span>
          <h1>재회운 계산을<br />시작하지 못했어요.</h1>
          <p>{result?.error || '7단계 입력을 모두 완료해 주세요.'}</p>
          <button type="button" onClick={edit}>
            입력 정보 확인
            <ArrowRight size={18} />
          </button>
        </section>
      </main>
    );
  }

  const report = result.report;
  const reunion = findReunionMetric(report, 'reunion');
  const recurrence = findReunionMetric(report, 'recurrence-risk');
  const readiness = findReunionMetric(report, 'readiness');
  const pillars = [
    ['시주', report.birthChart.self.pillars.hour],
    ['일주', report.birthChart.self.pillars.day],
    ['월주', report.birthChart.self.pillars.month],
    ['년주', report.birthChart.self.pillars.year]
  ];
  const previewAnswers = report.answerFirst.slice(0, 1);
  const hiddenAnswerCount = Math.max(0, report.answerFirst.length - previewAnswers.length);

  return (
    <main className="reunion-preview">
      <header className="reunion-preview__header">
        <button type="button" onClick={edit} aria-label="입력 수정">
          <ArrowLeft size={24} />
        </button>
        <div>
          <span>무료 미리보기</span>
          <strong>MZ큐피트 재회운</strong>
        </div>
        <i aria-hidden="true" />
      </header>

      <section className="reunion-comic reunion-comic--opening">
        <img
          src="/images/mz-love-fact/generated/reunion-shadow.webp"
          alt="붉은 인연의 실 앞에 선 두 사람의 그림자"
          width="941"
          height="1672"
        />
        <span className="reunion-comic__shade" aria-hidden="true" />
        <div className="reunion-comic__content">
          <span className="reunion-kicker">PROLOGUE · 청담 선생</span>
          <div className="reunion-bubble">
            <small>청담 선생</small>
            <p>왔네요, <strong>{report.customerName}</strong>님.</p>
            <p>
              “연락이 올까요?”보다 먼저 본 건
              <strong> 다시 만나도 같은 이유로 끝나지 않을 조건</strong>이에요.
            </p>
          </div>
          <div className="reunion-bubble is-customer">
            <small>{report.customerName}</small>
            <p>“{report.answerFirst[0]?.question}”</p>
          </div>
        </div>
      </section>

      <section className="reunion-comic reunion-comic--chart">
        <div className="reunion-comic__content is-static">
          <span className="reunion-kicker">CHAPTER 01 · 원국 확인</span>
          <div className="reunion-bubble">
            <small>청담 선생</small>
            <p>
              중심은 <strong>{report.birthChart.self.dayMaster} {report.birthChart.self.element} 일간</strong>.
              두 사람 원국과 실제 이별 사실은 섞지 않고 따로 계산했어요.
            </p>
          </div>
          <article className="reunion-chart-board">
            <header>
              <span>{report.customerName}님의 명식</span>
              <strong>{report.birthChart.self.precision}</strong>
            </header>
            <div>
              {pillars.map(([label, value]) => (
                <section key={label}>
                  <small>{label}</small>
                  <strong>{value || '미상'}</strong>
                </section>
              ))}
            </div>
            <footer>
              <span><Check size={14} /> 만세력 계산 완료</span>
              <span>
                {report.birthChart.partner.available
                  ? '두 사람 정적 궁합 연결'
                  : '상대 원국 미포함'}
              </span>
            </footer>
          </article>
          <div className="reunion-bubble is-fact">
            <small>계산 경계</small>
            <p>{report.birthChart.compatibilitySummary}</p>
          </div>
        </div>
      </section>

      <section className={'reunion-safety-verdict is-' + report.safety.severity}>
        <ShieldAlert size={24} />
        <span>SAFETY GATE · {report.safety.status}</span>
        <h2>{report.safety.title}</h2>
        <p>{report.safety.summary}</p>
        <ul>
          {report.safety.immediateActions.map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ul>
      </section>

      <section className="reunion-preview-answers">
        <span className="reunion-kicker">ANSWER FIRST</span>
        <h2>궁금한 것부터<br />바로 답할게요.</h2>
        {previewAnswers.map((answer, index) => (
          <article key={answer.question}>
            <span>0{index + 1}</span>
            <div>
              <h3>{answer.question}</h3>
              <p>{answer.answer}</p>
              <strong>{answer.nextAction}</strong>
            </div>
          </article>
        ))}
        {hiddenAnswerCount > 0 ? (
          <article className="is-locked" aria-label={`추가 답변 ${hiddenAnswerCount}개 잠김`}>
            <span><LockKeyhole size={17} aria-hidden="true" /></span>
            <div>
              <h3>선택한 질문 {hiddenAnswerCount}개의 답변이 더 있어요.</h3>
              <p>
                근거와 반대 근거, 바로 할 행동까지 전체 전략 리포트에서 이어집니다.
              </p>
              <strong>결제 후 전체 답변 공개</strong>
            </div>
          </article>
        ) : null}
      </section>

      <section className="reunion-index-teaser">
        <div>
          <span>재회 지수</span>
          <strong>{reunion?.score ?? '보류'}</strong>
          <small>/ 100 · 성사율 아님</small>
        </div>
        <div className="is-risk">
          <span>재발 위험</span>
          <strong>{recurrence?.score ?? '보류'}</strong>
          <small>/ 100</small>
        </div>
        <div>
          <span>준비도</span>
          <strong>{readiness?.score ?? '보류'}</strong>
          <small>/ 100</small>
        </div>
      </section>

      <section className="reunion-locked-preview">
        <LockKeyhole size={27} />
        <span>FULL STRATEGY · LOCKED</span>
        <h2>답은 봤고,<br />이제 움직일 조건을 볼 차례예요.</h2>
        <div className="reunion-locked-grid">
          {[
            '14개 분리 지표와 반대 근거',
            '지금·기다림·비접촉 세 선택 비교',
            '최대 3개 절기 연락 검토 구간',
            '메시지 위험 문구와 수정안',
            '답장 8갈래 의사결정 트리',
            '재회 후 30일·90일 실행 계획'
          ].map((item) => (
            <span key={item}><LockKeyhole size={14} /> {item}</span>
          ))}
        </div>
        <button
          type="button"
          onClick={unlock}
          aria-label={report.safety.status === 'ANALYSIS_BLOCKED'
            ? '\uC548\uC804 \uC548\uB0B4\uB9CC \uC81C\uACF5\uB429\uB2C8\uB2E4'
            : undefined}
          disabled={report.safety.status === 'ANALYSIS_BLOCKED'}
        >
          <Sparkles size={17} />
          {canOpenLocal ? '결제 없이 전체 리포트 검수' : '55,000원 · 전체 전략 잠금 풀기'}
          <ArrowRight size={18} />
        </button>
        <small>
          {canOpenLocal
            ? '로컬 개발 환경에서만 보이는 검수 버튼입니다.'
            : '재회·연락·상대 마음을 보장하지 않으며 안전 게이트가 항상 우선합니다.'}
        </small>
      </section>
    </main>
  );
}
