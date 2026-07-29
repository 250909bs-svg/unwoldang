import {
  ArrowLeft,
  Check,
  Download,
  LockKeyhole,
  ShieldCheck,
  Trash2
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ReportAccessMode } from '../lib/reportAccessGate';
import { clearReunionDraft, hydrateReunionIntake } from '../lib/reunion/intake';
import { buildReunionReport } from '../lib/reunion/reportEngine';
import type {
  ReunionEvidenceNode,
  ReunionIntakeData,
  ReunionMetric,
  ReunionReport,
  ReunionPlanPhase
} from '../lib/reunion/types';
import '../styles/reunion.css';

function EvidenceList({
  ids,
  evidence,
  title
}: {
  ids: string[];
  evidence: Map<string, ReunionEvidenceNode>;
  title: string;
}) {
  return (
    <div className="reunion-report__evidence-list">
      <strong>{title}</strong>
      {ids.map((id) => {
        const item = evidence.get(id);
        return item ? (
          <article key={id}>
            <span>{item.source}</span>
            <p>{item.detail}</p>
            <small>{Math.round(item.confidence * 100)}% 근거 신뢰도 · {item.id}</small>
          </article>
        ) : null;
      })}
    </div>
  );
}

function MetricCard({
  metric,
  evidence
}: {
  metric: ReunionMetric;
  evidence: Map<string, ReunionEvidenceNode>;
}) {
  return (
    <article className={'reunion-metric-card is-' + metric.band}>
      <header>
        <div>
          <span>{metric.label}</span>
          <strong>{metric.score ?? '보류'}{metric.score === null ? '' : '/100'}</strong>
        </div>
        <i style={{ '--metric-score': metric.score ?? 0 } as React.CSSProperties} />
      </header>
      <p>{metric.summary}</p>
      <details>
        <summary>근거와 반대 근거 보기</summary>
        <EvidenceList ids={metric.evidenceIds} evidence={evidence} title="이 결론을 지지한 근거" />
        <EvidenceList ids={metric.counterEvidenceIds} evidence={evidence} title="결론을 제한한 반대 근거" />
        <div className="reunion-metric-card__rules">
          <strong>확인 행동</strong>
          {metric.actions.map((item) => <p key={item}>· {item}</p>)}
          <strong>금지 행동</strong>
          {metric.prohibitedActions.map((item) => <p key={item}>· {item}</p>)}
        </div>
      </details>
    </article>
  );
}

function PlanColumn({
  title,
  phases
}: {
  title: string;
  phases: ReunionPlanPhase[];
}) {
  return (
    <section className="reunion-plan-column">
      <h3>{title}</h3>
      {phases.map((phase) => (
        <article key={phase.range}>
          <span>{phase.range}</span>
          <h4>{phase.goal}</h4>
          <ul>{phase.actions.map((item) => <li key={item}>{item}</li>)}</ul>
          <details>
            <summary>관찰 증거와 멈춤 규칙</summary>
            <strong>확인할 행동</strong>
            {phase.evidenceToObserve.map((item) => <p key={item}>· {item}</p>)}
            <strong>멈춤 규칙</strong>
            {phase.stopRules.map((item) => <p key={item}>· {item}</p>)}
          </details>
        </article>
      ))}
    </section>
  );
}

export default function ReunionReportExperience({
  formData,
  accessMode,
  prebuiltReport
}: {
  formData: Partial<ReunionIntakeData>;
  accessMode: ReportAccessMode;
  prebuiltReport?: ReunionReport;
}) {
  const navigate = useNavigate();
  const [deleteMessage, setDeleteMessage] = useState('');
  const input = useMemo(() => hydrateReunionIntake(formData), [formData]);
  const report = useMemo(
    () => prebuiltReport ?? buildReunionReport(input),
    [input, prebuiltReport]
  );
  const evidence = useMemo(
    () => new Map(report.evidence.map((item) => [item.id, item])),
    [report.evidence]
  );
  const coreMetricIds = new Set([
    'emotional-residue',
    'incoming-contact',
    'outgoing-suitability',
    'reply',
    'meeting',
    'reunion'
  ]);
  const coreMetrics = report.metrics.filter((metric) => coreMetricIds.has(metric.id));
  const sustainMetrics = report.metrics.filter((metric) => !coreMetricIds.has(metric.id));

  const removeLocalDraft = () => {
    clearReunionDraft();
    setDeleteMessage('이 기기에 임시 저장된 재회운 입력 초안을 삭제했습니다.');
  };

  return (
    <main className="reunion-report">
      <header className="reunion-report__topbar">
        <button type="button" onClick={() => navigate('/')} aria-label="홈으로">
          <ArrowLeft size={22} />
        </button>
        <div>
          <span>{accessMode === 'local-preview' ? 'LOCAL REVIEW' : 'PRIVATE REPORT'}</span>
          <strong>MZ큐피트 재회운</strong>
        </div>
        <button type="button" onClick={() => window.print()} aria-label="인쇄 또는 PDF 저장">
          <Download size={20} />
        </button>
      </header>

      <nav className="reunion-report__toc" aria-label="리포트 목차">
        {[
          ['answer', '결론'],
          ['safety', '안전'],
          ['chart', '두 사람'],
          ['indices', '14지표'],
          ['choices', '세 선택'],
          ['timing', '연락 창'],
          ['message', '메시지'],
          ['plan', '30·90일'],
          ['audit', '검증']
        ].map(([id, label]) => <a key={id} href={'#reunion-' + id}>{label}</a>)}
      </nav>

      <section className="reunion-report__hero">
        <img src="/home-love-reunion-card.png" alt="" width="992" height="1586" />
        <span aria-hidden="true" />
        <div>
          <small>REPORT · {report.analysisDate}</small>
          <h1>{report.customerName}님과<br />{report.partnerName}님의 재회 전략실</h1>
          <p>{report.headline}</p>
          <strong>{report.directVerdict}</strong>
          <em>청담 선생 · 자동 정밀 분석</em>
        </div>
      </section>

      <section id="reunion-answer" className="reunion-report__section reunion-report__answers">
        <header>
          <span>ANSWER FIRST</span>
          <h2>결론부터<br />세 문장으로.</h2>
        </header>
        {report.answerFirst.map((answer, index) => (
          <article key={answer.question}>
            <span>0{index + 1}</span>
            <div>
              <h3>{answer.question}</h3>
              <p>{answer.answer}</p>
              <strong>{answer.nextAction}</strong>
              <details>
                <summary>왜 이렇게 판단했나요?</summary>
                <EvidenceList ids={answer.evidenceIds} evidence={evidence} title="근거" />
                <EvidenceList ids={answer.counterEvidenceIds} evidence={evidence} title="반대 근거" />
              </details>
            </div>
          </article>
        ))}
      </section>

      <section id="reunion-safety" className={'reunion-report__section reunion-report__safety is-' + report.safety.severity}>
        <ShieldCheck size={31} />
        <span>SAFETY GATE · {report.safety.status}</span>
        <h2>{report.safety.title}</h2>
        <p>{report.safety.summary}</p>
        {report.safety.emergencyNotice ? <strong>{report.safety.emergencyNotice}</strong> : null}
        <ul>{report.safety.immediateActions.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>

      <section id="reunion-chart" className="reunion-report__section">
        <header>
          <span>MYEONGRI × REALITY</span>
          <h2>명리와 이별 사실을<br />섞지 않고 교차했습니다.</h2>
        </header>
        <div className="reunion-report__chart">
          {Object.entries(report.birthChart.self.pillars).map(([key, value]) => (
            <article key={key}>
              <span>{key.toUpperCase()}</span>
              <strong>{value || '미상'}</strong>
            </article>
          ))}
        </div>
        <div className="reunion-report__compatibility">
          <span>{report.birthChart.partner.available ? '두 사람 정적 궁합 연결됨' : '상대 원국 미포함'}</span>
          <p>{report.birthChart.compatibilitySummary}</p>
          <small>현재 대운·세운 완전 동시성 엔진이 아니며, 이 한계는 지표 신뢰도에 반영했습니다.</small>
        </div>
      </section>

      <section id="reunion-indices" className="reunion-report__section">
        <header>
          <span>14 SEPARATE INDICES</span>
          <h2>재회 하나로<br />뭉개지 않았어요.</h2>
          <p>모든 값은 의사결정 지수이며 실제 성사율이 아닙니다.</p>
        </header>
        <div className="reunion-metric-grid">
          {coreMetrics.map((metric) => <MetricCard key={metric.id} metric={metric} evidence={evidence} />)}
        </div>
        <h3 className="reunion-report__subheading">다시 만난 뒤를 보는 지표</h3>
        <div className="reunion-metric-grid">
          {sustainMetrics.map((metric) => <MetricCard key={metric.id} metric={metric} evidence={evidence} />)}
        </div>
      </section>

      <section id="reunion-choices" className="reunion-report__section">
        <header>
          <span>THREE CHOICES</span>
          <h2>지금 연락할까,<br />기다릴까, 멈출까.</h2>
        </header>
        <div className="reunion-choice-comparison">
          {report.choices.map((choice) => (
            <article key={choice.id} className={'is-' + choice.recommendation.toLowerCase()}>
              <span>{choice.recommendation}</span>
              <h3>{choice.label}</h3>
              <p><strong>얻는 것</strong>{choice.upside}</p>
              <p><strong>잃을 수 있는 것</strong>{choice.downside}</p>
              <details>
                <summary>필수 조건·멈춤 조건</summary>
                {choice.requirements.map((item) => <p key={item}>✓ {item}</p>)}
                {choice.stopConditions.map((item) => <p key={item}>× {item}</p>)}
              </details>
            </article>
          ))}
        </div>
      </section>

      <section id="reunion-timing" className="reunion-report__section">
        <header>
          <span>CONTACT WINDOWS</span>
          <h2>연락은 최대 세 구간만.</h2>
          <p>검증된 일진 추천 엔진이 없어 특정 하루를 만들지 않습니다.</p>
        </header>
        {report.contactWindows.length ? (
          <div className="reunion-window-list">
            {report.contactWindows.map((window) => (
              <article key={window.id}>
                <span>0{window.rank}</span>
                <div>
                  <small>{window.sourceMonth} · 흐름 지수 {window.score}</small>
                  <h3>{window.range}</h3>
                  <p><strong>채널</strong>{window.channel}</p>
                  <p><strong>첫 문장</strong>{window.firstLine}</p>
                  <p><strong>보낸 뒤</strong>{window.waitAfterSending}</p>
                  {window.cautions.map((item) => <em key={item}>{item}</em>)}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <aside className="reunion-report__withheld">
            <LockKeyhole size={22} />
            <h3>연락 구간을 제공하지 않습니다.</h3>
            <p>{report.safety.summary}</p>
          </aside>
        )}
      </section>

      <section id="reunion-message" className="reunion-report__section">
        <header>
          <span>MESSAGE REVIEW</span>
          <h2>보낼 말보다<br />보내지 말아야 할 말부터.</h2>
        </header>
        {report.messageReview.revisedMessage ? (
          <>
            <div className="reunion-message-card">
              <small>{report.messageReview.recommendedChannel} · {report.messageReview.lengthGuide}</small>
              <p>{report.messageReview.revisedMessage}</p>
            </div>
            {report.messageReview.riskFlags.length ? (
              <aside className="reunion-message-risk">
                입력 문장에서 감지: {report.messageReview.riskFlags.join(' · ')}
              </aside>
            ) : null}
            <div className="reunion-do-not-send">
              {report.messageReview.doNotSend.map((item) => <span key={item}>× {item}</span>)}
            </div>
          </>
        ) : (
          <aside className="reunion-report__withheld">
            <LockKeyhole size={22} />
            <h3>메시지 문장을 제공하지 않습니다.</h3>
            <p>{report.messageReview.lengthGuide}</p>
          </aside>
        )}

        {report.replyTree.length ? (
          <div className="reunion-reply-tree">
            <h3>답장 뒤 8갈래 판단</h3>
            {report.replyTree.map((branch) => (
              <article key={branch.id} className={branch.stop ? 'is-stop' : undefined}>
                <span>{branch.signal}</span>
                <p>{branch.interpretation}</p>
                <strong>{branch.response}</strong>
                <small>{branch.wait}</small>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section id="reunion-plan" className="reunion-report__section">
        <header>
          <span>CHANGE PLAN</span>
          <h2>재회보다 어려운 것,<br />재회 뒤 달라지는 일.</h2>
        </header>
        <div className="reunion-plan-grid">
          <PlanColumn title="첫 30일" phases={report.plan30} />
          <PlanColumn title="90일까지" phases={report.plan90} />
        </div>
      </section>

      <section id="reunion-audit" className="reunion-report__section reunion-report__audit">
        <header>
          <span>ENGINE & QA</span>
          <h2>계산한 것과<br />계산하지 않은 것.</h2>
        </header>
        <div className="reunion-component-list">
          {report.components.map((component) => (
            <article key={component.id}>
              <span className={component.status === 'UNVERIFIED' ? 'is-warn' : undefined}>
                {component.status}
              </span>
              <h3>{component.label}</h3>
              <p>{component.note}</p>
              <small>{component.version} · 점수 반영 {component.usedForScoring ? '예' : '아니오'}</small>
            </article>
          ))}
        </div>
        <div className="reunion-audit-checks">
          {report.audit.checks.map((check) => (
            <p key={check.id} className={check.passed ? 'is-pass' : 'is-fail'}>
              {check.passed ? <Check size={15} /> : '×'} {check.label}
              <small>{check.detail}</small>
            </p>
          ))}
        </div>
        <div className="reunion-limitations">
          <strong>중요한 한계</strong>
          {report.limitations.map((item) => <p key={item}>· {item}</p>)}
        </div>
        <div className="reunion-confidence">
          <span>이번 리포트 신뢰도</span>
          <strong>{report.confidence.label} · {Math.round(report.confidence.score * 100)}%</strong>
          {report.confidence.reasons.map((item) => <p key={item}>· {item}</p>)}
        </div>
      </section>

      <footer className="reunion-report__footer">
        <p>© 운월당 · MZ큐피트 재회운</p>
        <button type="button" onClick={() => window.print()}>
          <Download size={16} /> 인쇄·PDF 저장
        </button>
        <button type="button" onClick={removeLocalDraft}>
          <Trash2 size={16} /> 이 기기 입력 초안 삭제
        </button>
        {deleteMessage ? <span role="status">{deleteMessage}</span> : null}
        <small>원격 보관함 삭제는 계정·보관함의 삭제 기능이 구현되기 전까지 고객센터를 통해 요청해 주세요.</small>
      </footer>
    </main>
  );
}
