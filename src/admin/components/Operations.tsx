import { AlertTriangle, ArrowUpRight, Gauge, Target } from 'lucide-react';
import type { CSSProperties } from 'react';
import { getLargestDrop } from '../data/adminAnalytics';
import type {
  AdminOrder,
  ChannelPerformanceRow,
  ExecutiveAlert,
  FunnelStep,
  RetentionCohortRow
} from '../types/admin';
import { clamp, formatCurrency, formatDateTime, formatPercent, getConversion } from '../utils/formatters';
import { maskName } from '../utils/masking';

export function CustomerJourneyMap({
  funnel,
  largestDrop
}: {
  funnel: FunnelStep[];
  largestDrop: ReturnType<typeof getLargestDrop>;
}) {
  const hasTrafficData = Boolean(funnel[0]?.count);

  return (
    <article className="admin-command-panel admin-journey-map">
      <div className="admin-command-head">
        <div>
          <span>{hasTrafficData ? '실시간 고객 여정' : '고객 여정 이벤트 미수집'}</span>
          <h2>고객 흐름 지도</h2>
        </div>
        <strong>{hasTrafficData ? `핵심 병목 ${formatPercent(largestDrop.drop)}` : '유입 데이터 미수집'}</strong>
      </div>
      <div className="admin-journey-line" aria-label="고객 여정 단계">
        {funnel.map((step, index) => {
          const isCritical = largestDrop.label.includes(step.label);
          const width = clamp(getConversion(step.count, funnel[0].count), 8, 100);

          return (
            <div key={step.key} className={isCritical ? 'critical' : ''}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{step.label}</strong>
              <b>{hasTrafficData || index >= 5 ? step.count.toLocaleString('ko-KR') : '—'}</b>
              <i>
                <em style={{ width: `${width}%` }} />
              </i>
              <small>{hasTrafficData ? index === 0 ? '방문 시작' : `${formatPercent(step.benchmark)} 전환` : index >= 5 ? '리포트 보관 기록' : '이벤트 미수집'}</small>
            </div>
          );
        })}
      </div>
      <div className="admin-journey-callout">
        <AlertTriangle size={17} />
        <p>
          <strong>{largestDrop.label}</strong>
          <span>{hasTrafficData ? '이 구간의 문구, 로딩, 가격 안내, 버튼 위치를 먼저 손보면 매출 개선 가능성이 가장 큽니다.' : 'analytics_events가 연결되기 전에는 방문·입력·결제창 이탈을 판단하지 않습니다.'}</span>
        </p>
      </div>
    </article>
  );
}

export function ActionCommand({
  actions
}: {
  actions: Array<{ status: string; title: string; body: string; tone?: 'warn' | 'good' }>;
}) {
  return (
    <article className="admin-command-panel admin-action-command">
      <div className="admin-command-head">
        <div>
          <span>오늘 우선순위</span>
          <h2>오늘 액션 큐</h2>
        </div>
        <strong>{actions.length}개</strong>
      </div>
      <div className="admin-action-list">
        {actions.map((action, index) => (
          <div key={action.title} className={action.tone || ''}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <div>
              <b>{action.status}</b>
              <strong>{action.title}</strong>
              <p>{action.body}</p>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

export function LiveActivityFeed({
  orders,
  onSelectOrder
}: {
  orders: AdminOrder[];
  onSelectOrder: (orderId: string) => void;
}) {
  const recentOrders = [...orders]
    .sort((left, right) => +new Date(right.createdAt) - +new Date(left.createdAt))
    .slice(0, 6);
  const isFixtureData = orders.some((order) => order.analyticsEstimated);
  const statusLabels: Record<AdminOrder['status'], string> = {
    paid: '결제 완료',
    pending: '결제 대기',
    failed: '결제 실패',
    refunded: '환불 완료'
  };

  return (
    <article className="admin-command-panel admin-live-feed">
      <div className="admin-command-head">
        <div>
          <span>{isFixtureData ? '실시간 활동' : '최근 보관 기록'}</span>
          <h2>{isFixtureData ? '최근 결제·리포트' : '최근 완료 리포트'}</h2>
        </div>
        <strong className="admin-live-status"><i /> {isFixtureData ? 'LIVE' : '보관 기록'}</strong>
      </div>
      <div className="admin-live-list">
        {recentOrders.length ? recentOrders.map((order) => (
          <button key={order.id} type="button" onClick={() => onSelectOrder(order.id)}>
            <i className={`admin-live-dot ${order.status}`} />
            <span>
              <strong>{maskName(order.customerName)} · {order.productName}</strong>
              <small>{order.orderId}</small>
            </span>
            <b>{order.source === 'real' ? '리포트 보관' : statusLabels[order.status]}</b>
            <time>{formatDateTime(order.createdAt)}</time>
            <ArrowUpRight size={15} aria-hidden="true" />
          </button>
        )) : (
          <p className="admin-live-empty">선택한 기간에 기록된 활동이 없습니다.</p>
        )}
      </div>
    </article>
  );
}

export function ExecutiveCommandCenter({
  healthScore,
  forecastRevenue,
  opportunityRevenue,
  repeatRate,
  largestDrop,
  bestChannel,
  periodLabel,
  isEstimated
}: {
  healthScore: number;
  forecastRevenue: number;
  opportunityRevenue: number;
  repeatRate: number;
  largestDrop: ReturnType<typeof getLargestDrop>;
  bestChannel?: ChannelPerformanceRow;
  periodLabel: string;
  isEstimated: boolean;
}) {
  const status = !isEstimated ? '분석 미수집' : healthScore >= 85 ? '안정 성장' : healthScore >= 70 ? '개선 여지' : '집중 점검';

  return (
    <article className="admin-executive-board">
      <div className="admin-executive-head">
        <div>
          <span>경영 판단 요약</span>
          <h2>오늘의 운영 결론</h2>
        </div>
        <div className="admin-estimate-badge">
          <Gauge size={14} /> {isEstimated ? '개발 fixture 추정 지표' : '분석 이벤트 미수집'}
        </div>
      </div>

      <div className="admin-executive-body">
        <div className="admin-score-block">
          <div
            className="admin-score-ring"
            style={{ background: `conic-gradient(#23a094 ${(isEstimated ? clamp(healthScore) : 0) * 3.6}deg, rgba(255,255,255,.12) 0deg)` }}
            aria-label={isEstimated ? `운영 건강도 ${healthScore}점` : '운영 건강도 분석 미수집'}
          >
            <div>
              <strong>{isEstimated ? healthScore : '—'}</strong>
              <span>{isEstimated ? '/ 100' : '미수집'}</span>
            </div>
          </div>
          <p>
            <strong>{status}</strong>
            <span>{periodLabel} 운영 건강도</span>
          </p>
        </div>

        <div className="admin-executive-kpis">
          <div>
            <span>{isEstimated ? '30일 매출 전망' : '30일 실제 매출 전망'} <em>추정</em></span>
            <strong>{isEstimated ? formatCurrency(forecastRevenue) : '미수집'}</strong>
            <small>{isEstimated ? '현재 선택 기간의 일평균을 월 단위로 환산' : '실제 결제금액과 주문 원장 연결 필요'}</small>
          </div>
          <div>
            <span>회수 가능 매출 <em>추정</em></span>
            <strong>{isEstimated ? formatCurrency(opportunityRevenue) : '미수집'}</strong>
            <small>{isEstimated ? '핵심 병목 전환율 5%p 개선 시' : '유입·전환 이벤트 연결 필요'}</small>
          </div>
          <div>
            <span>{isEstimated ? '재구매 고객 비중' : '반복 리포트 고객 비중'}</span>
            <strong>{formatPercent(repeatRate)}</strong>
            <small>{isEstimated ? '결제 고객 중 두 번 이상 구매한 비율' : '완료 리포트 기록이 두 번 이상인 고객 비율'}</small>
          </div>
          <div>
            <span>최고 효율 채널 <em>추정</em></span>
            <strong>{isEstimated ? bestChannel?.label || '데이터 없음' : '미수집'}</strong>
            <small>{isEstimated ? bestChannel?.estimatedRoas ? `ROAS ${Math.round(bestChannel.estimatedRoas)}%` : '자연 유입 채널' : '유입·광고비 이벤트 연결 필요'}</small>
          </div>
        </div>
      </div>

      <div className="admin-executive-decision">
        <Target size={18} />
        <p>
          <span>가장 먼저 손볼 곳</span>
          <strong>{isEstimated ? largestDrop.label : '유입 분석 이벤트 연결'}</strong>
          <small>{isEstimated ? '기능을 더 늘리기보다 이 구간의 이탈 원인부터 제거해야 같은 유입으로 더 많은 매출을 만들 수 있습니다.' : '실측 이벤트가 없으므로 병목을 추정하지 않습니다.'}</small>
        </p>
      </div>
    </article>
  );
}

export function DecisionAlertCenter({ alerts }: { alerts: ExecutiveAlert[] }) {
  const urgentCount = alerts.filter((alert) => alert.severity === 'critical' || alert.severity === 'warning').length;
  const isAnalysisMissing = alerts.length > 0 && alerts.every((alert) => alert.severity === 'watch');

  return (
    <article className="admin-command-panel admin-alert-center">
      <div className="admin-command-head">
        <div>
          <span>관제 알림과 SLA</span>
          <h2>운영 리스크 센터</h2>
        </div>
        <strong className={urgentCount ? 'warn' : isAnalysisMissing ? '' : 'good'}>{urgentCount ? `${urgentCount}건 조치` : isAnalysisMissing ? '분석 미수집' : '정상'}</strong>
      </div>
      <div className="admin-alert-list">
        {alerts.map((alert) => (
          <div key={alert.id} className={alert.severity}>
            <span className="admin-alert-severity">{alert.severity === 'critical' ? '긴급' : alert.severity === 'warning' ? '주의' : alert.severity === 'watch' ? '관찰' : '정상'}</span>
            <div>
              <strong>{alert.title}</strong>
              <p>{alert.body}</p>
            </div>
            <b>{alert.metric}</b>
            <small>{alert.owner} · {alert.sla}</small>
          </div>
        ))}
      </div>
    </article>
  );
}

export function ChannelEfficiencyTable({ rows }: { rows: ChannelPerformanceRow[] }) {
  const hasAcquisitionData = rows.some((row) => row.sessions > 0);

  return (
    <article className="admin-command-panel admin-channel-efficiency">
      <div className="admin-command-head">
        <div>
          <span>획득 효율</span>
          <h2>{hasAcquisitionData ? '채널별 매출·CAC·ROAS' : '유입·비용 데이터 미수집'}</h2>
        </div>
        <strong>{hasAcquisitionData ? '비용 추정' : '미수집'}</strong>
      </div>
      <div className="admin-channel-table-wrap">
        <div className="admin-channel-table">
          <div className="head">
            <span>채널</span>
            <span>세션</span>
            <span>결제</span>
            <span>전환</span>
            <span>매출</span>
            <span>CAC</span>
            <span>ROAS</span>
            <span>권장 액션</span>
          </div>
          {rows.map((row) => (
            <div key={row.label}>
              <strong>{row.label}</strong>
              <span>{hasAcquisitionData ? row.sessions.toLocaleString('ko-KR') : '미수집'}</span>
              <span>{row.orders}건</span>
              <span>{hasAcquisitionData ? formatPercent(row.conversion) : '미수집'}</span>
              <b>{formatCurrency(row.revenue)}{hasAcquisitionData ? '' : ' · 카탈로그'}</b>
              <span>{hasAcquisitionData ? row.estimatedSpend ? formatCurrency(row.estimatedCac) : '자연유입' : '미수집'}</span>
              <em className={row.estimatedRoas >= 350 ? 'good' : row.estimatedSpend ? 'warn' : ''}>
                {hasAcquisitionData ? row.estimatedSpend ? `${Math.round(row.estimatedRoas)}%` : '-' : '미수집'}
              </em>
              <p>{row.action}</p>
            </div>
          ))}
        </div>
      </div>
      <p className="admin-estimate-note">{hasAcquisitionData ? '광고비가 아직 연결되지 않아 CAC와 ROAS는 매출·세션 기반 추정값입니다. 광고 플랫폼 비용 API 연결 시 실측값으로 자동 교체할 수 있습니다.' : '유입·세션·광고비 데이터가 없어 CAC와 ROAS를 계산하지 않습니다. 금액은 상품 registry의 카탈로그 가격 합계입니다.'}</p>
    </article>
  );
}

export function RetentionCohortMatrix({ rows }: { rows: RetentionCohortRow[] }) {
  const columns = ['가입', 'D+1', 'D+3', 'D+7', 'D+14'];

  return (
    <article className="admin-command-panel admin-cohort-panel">
      <div className="admin-command-head">
        <div>
          <span>고객 유지 신호</span>
          <h2>가입 코호트</h2>
        </div>
        <strong>{rows.length ? '개발 fixture 기반' : '분석 이벤트 미수집'}</strong>
      </div>
      <div className="admin-cohort-grid">
        <span>가입 주차</span>
        {columns.map((column) => <b key={column}>{column}</b>)}
        {rows.length ? rows.map((row) => (
          <div className="admin-cohort-row" key={row.key}>
            <strong>{row.label}<small>{row.customers}명</small></strong>
            {row.retention.map((value, index) => (
              <span
                key={`${row.key}-${columns[index]}`}
                className={value >= 65 ? 'strong' : value >= 35 ? 'medium' : ''}
                style={{ '--cohort-alpha': `${0.08 + clamp(value) / 118}` } as CSSProperties}
                title={`${row.label} ${columns[index]} ${formatPercent(value)}`}
              >
                {Math.round(value)}%
              </span>
            ))}
          </div>
        )) : <p>선택한 기간에 코호트 데이터가 없습니다.</p>}
      </div>
      <p className="admin-estimate-note">가입 이후 결제, 열람, 재구매 신호를 묶은 운영용 코호트입니다. 이벤트 DB 연결 전에는 실제 재방문율과 다를 수 있습니다.</p>
    </article>
  );
}
