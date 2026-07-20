import { Clock, Eye, MessageSquareWarning } from 'lucide-react';
import { DonutChart, InsightCard } from '../components';
import type { buildDeviceRows, buildIssueRows } from '../data/adminAnalytics';
import type { AdminOrder } from '../types/admin';
import { formatPercent, getConversion } from '../utils/formatters';

export function Reports({
  deviceRows,
  avgReadRate,
  avgLatency,
  issueRows,
  orders
}: {
  deviceRows: ReturnType<typeof buildDeviceRows>;
  avgReadRate: number;
  avgLatency: number;
  issueRows: ReturnType<typeof buildIssueRows>;
  orders: AdminOrder[];
}) {
  const activeView = 'reports' as const;

  return (
    <>
      {activeView === 'reports' ? (
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <span>리포트 품질</span>
              <h2>리포트 생성/열람 관리</h2>
            </div>
            <p>고객 만족도는 열람률, 신고율, 생성 지연, 재방문 여부로 관리합니다.</p>
          </div>

          <div className="admin-report-layout">
            <DonutChart title="기기별 리포트 열람" rows={deviceRows} centerLabel="결제" />
            <div className="admin-quality-board">
              <InsightCard title="평균 열람률" value={`${avgReadRate}%`} body="80% 아래 상품은 본문 길이와 초반 요약을 점검합니다." icon={Eye} tone="good" />
              <InsightCard title="평균 생성 시간" value={`${avgLatency}초`} body="60초 이상이면 로딩 화면 이탈 가능성이 커집니다." icon={Clock} />
              <InsightCard title="신고율" value={formatPercent(getConversion(issueRows.length, orders.length))} body="계산 불일치와 오타 신고를 분리해서 봅니다." icon={MessageSquareWarning} tone="warn" />
            </div>
          </div>

          <div className="admin-report-grid">
            {orders.map((order) => (
              <article key={order.id}>
                <div>
                  <strong>{order.productName}</strong>
                  <span>{order.orderId} · {order.sourceChannel}</span>
                </div>
                <div className="admin-read-meter">
                  <i style={{ width: `${order.readRate}%` }} />
                </div>
                <p>{order.readRate}% 열람 · 생성 {order.reportLatencySec}초 · 신고 {order.issueCount}건 · {order.reportStatus}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

    </>
  );
}
