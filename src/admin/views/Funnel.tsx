import { AlertTriangle, CreditCard, MousePointerClick, Zap } from 'lucide-react';
import { InsightCard } from '../components';
import type { FunnelStep } from '../types/admin';
import { formatPercent, getConversion } from '../utils/formatters';

export function Funnel({
  largestDrop,
  funnel,
  mobileShare
}: {
  largestDrop: { label: string; drop: number };
  funnel: FunnelStep[];
  mobileShare: number;
}) {
  const activeView = 'funnel' as const;

  return (
    <>
      {activeView === 'funnel' ? (
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <span>이탈 분석</span>
              <h2>단계별 이탈 분석</h2>
            </div>
            <p>방문부터 결제 성공까지 어디를 고치면 매출이 바로 오르는지 확인합니다.</p>
          </div>

          <div className="admin-insight-grid">
            <InsightCard title="최대 이탈" value={formatPercent(largestDrop.drop)} body={largestDrop.label} icon={AlertTriangle} tone="warn" />
            <InsightCard title="결제 진입률" value={formatPercent(funnel[4]?.benchmark || 0)} body="입력 완료 후 결제창까지 이어진 비율" icon={CreditCard} />
            <InsightCard title="모바일 비중" value={formatPercent(mobileShare)} body="모바일 UI가 매출에 가장 큰 영향을 줍니다." icon={MousePointerClick} tone="good" />
            <InsightCard title="우선 액션" value="결제 직전" body="금액, 제공 항목, 환불 기준을 더 짧게 보여주세요." icon={Zap} />
          </div>

          <div className="admin-funnel-visual">
            {funnel.map((step, index) => (
              <div key={step.key} style={{ width: `${Math.max(16, getConversion(step.count, funnel[0].count))}%` }}>
                <strong>{step.label}</strong>
                <span>{step.count.toLocaleString('ko-KR')}명</span>
                <em>{index === 0 ? '방문 기준' : `${formatPercent(step.benchmark)} 전환`}</em>
              </div>
            ))}
          </div>

          <div className="admin-funnel-table">
            {funnel.map((step, index) => {
              const prev = funnel[index - 1]?.count || step.count;
              const drop = index === 0 ? 0 : 100 - getConversion(step.count, prev);

              return (
                <article key={step.key}>
                  <div>
                    <strong>{step.label}</strong>
                    <span>{step.key}</span>
                  </div>
                  <b>{step.count.toLocaleString('ko-KR')}</b>
                  <em>{index === 0 ? '기준점' : `${formatPercent(drop)} 이탈`}</em>
                  <div className="admin-wide-bar">
                    <i style={{ width: `${Math.max(6, getConversion(step.count, funnel[0].count))}%` }} />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

    </>
  );
}
