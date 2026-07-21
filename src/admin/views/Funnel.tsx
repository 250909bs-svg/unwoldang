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
  const hasTrafficData = Boolean(funnel[0]?.count);

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
            <InsightCard title="최대 이탈" value={hasTrafficData ? formatPercent(largestDrop.drop) : '미수집'} body={largestDrop.label} icon={AlertTriangle} tone="warn" />
            <InsightCard title="결제 진입률" value={hasTrafficData ? formatPercent(funnel[4]?.benchmark || 0) : '미수집'} body={hasTrafficData ? '입력 완료 후 결제창까지 이어진 비율' : '입력·결제창 이벤트가 연결되지 않았습니다.'} icon={CreditCard} />
            <InsightCard title="모바일 비중" value={hasTrafficData ? formatPercent(mobileShare) : '미수집'} body={hasTrafficData ? '모바일 UI가 매출에 가장 큰 영향을 줍니다.' : '기기 이벤트가 연결되지 않았습니다.'} icon={MousePointerClick} tone="good" />
            <InsightCard title="우선 액션" value={hasTrafficData ? '결제 직전' : '데이터 연결'} body={hasTrafficData ? '금액, 제공 항목, 환불 기준을 더 짧게 보여주세요.' : 'analytics_events 연결 전에는 이탈 구간을 추정하지 않습니다.'} icon={Zap} />
          </div>

          <div className="admin-funnel-visual">
            {funnel.map((step, index) => (
              <div key={step.key} style={{ width: `${Math.max(16, getConversion(step.count, funnel[0].count))}%` }}>
                <strong>{step.label}</strong>
                <span>{hasTrafficData || index >= 5 ? `${step.count.toLocaleString('ko-KR')}건` : '미수집'}</span>
                <em>{hasTrafficData ? index === 0 ? '방문 기준' : `${formatPercent(step.benchmark)} 전환` : index >= 5 ? '리포트 보관 기록' : '이벤트 미수집'}</em>
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
                  <b>{hasTrafficData || index >= 5 ? step.count.toLocaleString('ko-KR') : '—'}</b>
                  <em>{hasTrafficData ? index === 0 ? '기준점' : `${formatPercent(drop)} 이탈` : index >= 5 ? '보관 기록' : '미수집'}</em>
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
