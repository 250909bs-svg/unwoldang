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
            title="오늘 결제"
            value={`${todayPaidCount}건`}
            delta={`${formatCurrency(todayRevenue)} · 전일 ${formatCurrency(previousDayRevenue)}`}
            trend={todayPaidChange}
            trendLabel="전일 동시간"
            icon={CreditCard}
            tone="good"
          />
          <MetricCard
            title={`${periodLabels[period]} 매출`}
            value={formatCurrency(totalRevenue)}
            delta={`객단가 ${formatCurrency(avgOrderValue)} · ${formatChangeRate(aovChange)}`}
            trend={revenueChange}
            trendLabel={trendLabel}
            icon={WalletCards}
            tone="good"
          />
          <MetricCard
            title="결제 성공률"
            value={formatPercent(successRate)}
            delta={`${paidOrders.length}/${orders.length}건 성공`}
            trend={successRateChange}
            trendLabel={trendLabel}
            icon={TrendingUp}
          />
          <MetricCard
            title="리포트 열람"
            value={`${avgReadRate}%`}
            delta={`90% 이상 ${formatPercent(reportRead90)}`}
            trend={readRateChange}
            trendLabel={trendLabel}
            icon={Eye}
          />
          <MetricCard
            title="이탈 집중 구간"
            value={formatPercent(largestDrop.drop)}
            delta={comparison === 'none' ? largestDrop.label : `${largestDrop.label} · ${trendLabel} ${formatPercent(previousLargestDrop.drop)}`}
            icon={MousePointerClick}
            tone="warn"
          />
          <MetricCard
            title="추정 순매출"
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
              title={`${granularityLabels[granularity]} 매출 흐름`}
              rangeLabel={selectedRangeLabel}
            />
            <DonutChart title="유입 채널별 결제" rows={channelRows} centerLabel="결제" />
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
            <HealthRadar items={healthItems} />
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
