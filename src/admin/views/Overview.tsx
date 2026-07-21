import { CreditCard, Eye, LineChart, MousePointerClick, TrendingUp, WalletCards } from 'lucide-react';
import {
  ActionCommand,
  ChannelEfficiencyTable,
  CustomerJourneyMap,
  DecisionAlertCenter,
  DonutChart,
  ExecutiveCommandCenter,
  HealthRadar,
  LiveActivityFeed,
  MetricCard,
  ProductPortfolioMatrix,
  RetentionCohortMatrix,
  RevenueTrendChart
} from '../components';
import type {
  buildChannelRows,
  buildProductRows,
  buildRetentionCohorts,
  buildTimeSeries
} from '../data/adminAnalytics';
import type {
  AdminComparison,
  AdminGranularity,
  AdminOrder,
  AdminPeriod,
  AdminView,
  ChannelPerformanceRow,
  ExecutiveAlert,
  FunnelStep
} from '../types/admin';
import { formatChangeRate, formatCurrency, formatPercent } from '../utils/formatters';

export function Overview({
  todayPaidCount,
  todayPaidChange,
  todayRevenue,
  previousDayRevenue,
  periodLabels,
  period,
  totalRevenue,
  avgOrderValue,
  aovChange,
  revenueChange,
  successRate,
  paidOrders,
  orders,
  successRateChange,
  trendLabel,
  avgReadRate,
  reportRead90,
  readRateChange,
  largestDrop,
  comparison,
  previousLargestDrop,
  netRevenue,
  apiCost,
  paymentFee,
  netRevenueChange,
  healthScore,
  forecastRevenue,
  opportunityRevenue,
  repeatRate,
  bestChannel,
  hasEstimatedAnalytics,
  executiveAlerts,
  timeSeries,
  granularityLabels,
  granularity,
  selectedRangeLabel,
  channelRows,
  allOrders,
  setSelectedOrderId,
  setActiveView,
  funnel,
  healthItems,
  channelPerformanceRows,
  retentionCohorts,
  productRows,
  actionRows
}: {
  todayPaidCount: number;
  todayPaidChange?: number;
  todayRevenue: number;
  previousDayRevenue: number;
  periodLabels: Record<AdminPeriod, string>;
  period: AdminPeriod;
  totalRevenue: number;
  avgOrderValue: number;
  aovChange?: number;
  revenueChange?: number;
  successRate: number;
  paidOrders: AdminOrder[];
  orders: AdminOrder[];
  successRateChange?: number;
  trendLabel: string;
  avgReadRate: number;
  reportRead90: number;
  readRateChange?: number;
  largestDrop: { label: string; drop: number };
  comparison: AdminComparison;
  previousLargestDrop: { label: string; drop: number };
  netRevenue: number;
  apiCost: number;
  paymentFee: number;
  netRevenueChange?: number;
  healthScore: number;
  forecastRevenue: number;
  opportunityRevenue: number;
  repeatRate: number;
  bestChannel?: ChannelPerformanceRow;
  hasEstimatedAnalytics: boolean;
  executiveAlerts: ExecutiveAlert[];
  timeSeries: ReturnType<typeof buildTimeSeries>;
  granularityLabels: Record<AdminGranularity, string>;
  granularity: AdminGranularity;
  selectedRangeLabel: string;
  channelRows: ReturnType<typeof buildChannelRows>;
  allOrders: AdminOrder[];
  setSelectedOrderId: (orderId: string) => void;
  setActiveView: (view: AdminView) => void;
  funnel: FunnelStep[];
  healthItems: Array<{ label: string; value: number; display: string; note: string }>;
  channelPerformanceRows: ChannelPerformanceRow[];
  retentionCohorts: ReturnType<typeof buildRetentionCohorts>;
  productRows: ReturnType<typeof buildProductRows>;
  actionRows: Array<{ status: string; title: string; body: string; tone?: 'warn' | 'good' }>;
}) {
  const activeView = 'overview' as const;

  return (
    <>
      {activeView === 'overview' ? (
        <section className="admin-metric-grid">
          <MetricCard
            title={hasEstimatedAnalytics ? '오늘 결제' : '오늘 완료 리포트'}
            value={`${todayPaidCount}건`}
            delta={hasEstimatedAnalytics ? `${formatCurrency(todayRevenue)} · 전일 ${formatCurrency(previousDayRevenue)}` : `카탈로그 합계 ${formatCurrency(todayRevenue)} · 전일 ${formatCurrency(previousDayRevenue)}`}
            trend={todayPaidChange}
            trendLabel="전일 동시간"
            icon={CreditCard}
            tone="good"
          />
          <MetricCard
            title={hasEstimatedAnalytics ? `${periodLabels[period]} 매출` : `${periodLabels[period]} 카탈로그 합계`}
            value={formatCurrency(totalRevenue)}
            delta={`${hasEstimatedAnalytics ? '객단가' : '건당 카탈로그 가격'} ${formatCurrency(avgOrderValue)} · ${formatChangeRate(aovChange)}`}
            trend={revenueChange}
            trendLabel={trendLabel}
            icon={WalletCards}
            tone="good"
          />
          <MetricCard
            title="결제 성공률"
            value={hasEstimatedAnalytics ? formatPercent(successRate) : '미수집'}
            delta={hasEstimatedAnalytics ? `${paidOrders.length}/${orders.length}건 성공` : '실제 주문 성공·실패 원장 필요'}
            trend={hasEstimatedAnalytics ? successRateChange : undefined}
            trendLabel={trendLabel}
            icon={TrendingUp}
          />
          <MetricCard
            title="리포트 열람"
            value={hasEstimatedAnalytics ? `${avgReadRate}%` : '미수집'}
            delta={hasEstimatedAnalytics ? `90% 이상 ${formatPercent(reportRead90)}` : '열람 이벤트 연결 필요'}
            trend={hasEstimatedAnalytics ? readRateChange : undefined}
            trendLabel={trendLabel}
            icon={Eye}
          />
          <MetricCard
            title="이탈 집중 구간"
            value={hasEstimatedAnalytics ? formatPercent(largestDrop.drop) : '미수집'}
            delta={hasEstimatedAnalytics ? comparison === 'none' ? largestDrop.label : `${largestDrop.label} · ${trendLabel} ${formatPercent(previousLargestDrop.drop)}` : largestDrop.label}
            icon={MousePointerClick}
            tone="warn"
          />
          <MetricCard
            title={hasEstimatedAnalytics ? '추정 순매출' : '카탈로그 기반 순매출 추정'}
            value={formatCurrency(netRevenue)}
            delta={`API ${formatCurrency(apiCost)} · 수수료 ${formatCurrency(paymentFee)}`}
            trend={netRevenueChange}
            trendLabel={trendLabel}
            icon={LineChart}
            tone="blue"
          />
        </section>
      ) : null}

      {activeView === 'overview' ? (
        <>
          <section className="admin-executive-grid">
            <ExecutiveCommandCenter
              healthScore={healthScore}
              forecastRevenue={forecastRevenue}
              opportunityRevenue={opportunityRevenue}
              repeatRate={repeatRate}
              largestDrop={largestDrop}
              bestChannel={bestChannel}
              periodLabel={periodLabels[period]}
              isEstimated={hasEstimatedAnalytics}
            />
            <DecisionAlertCenter alerts={executiveAlerts} />
          </section>

          <section className="admin-overview-analytics">
            <RevenueTrendChart
              data={timeSeries}
              title={hasEstimatedAnalytics ? `${granularityLabels[granularity]} 매출 흐름` : `${granularityLabels[granularity]} 카탈로그 합계 흐름`}
              rangeLabel={selectedRangeLabel}
            />
            <DonutChart title={hasEstimatedAnalytics ? '유입 채널별 결제' : '출처 미수집 완료 리포트'} rows={channelRows} centerLabel={hasEstimatedAnalytics ? '결제' : '기록'} />
            <LiveActivityFeed
              orders={allOrders}
              onSelectOrder={(orderId) => {
                setSelectedOrderId(orderId);
                setActiveView('orders');
              }}
            />
          </section>

          <section className="admin-command-grid">
            <CustomerJourneyMap funnel={funnel} largestDrop={largestDrop} />
            <HealthRadar items={healthItems} isEstimated={hasEstimatedAnalytics} />
          </section>

          <section className="admin-growth-grid">
            <ChannelEfficiencyTable rows={channelPerformanceRows} />
            <RetentionCohortMatrix rows={retentionCohorts} />
          </section>

          <section className="admin-visual-grid">
            <ProductPortfolioMatrix rows={productRows} />
            <ActionCommand actions={actionRows} />
          </section>
        </>
      ) : null}

    </>
  );
}
