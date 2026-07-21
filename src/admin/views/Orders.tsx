import { AlertTriangle, CalendarDays, Clock, MousePointerClick } from 'lucide-react';
import {
  CustomerDetailPanel,
  DonutChart,
  HourlyBarChart,
  InsightCard,
  OrderDetailPanel,
  RevenueTrendChart
} from '../components';
import type { buildChannelRows, buildHourlyRows, buildTimeSeries } from '../data/adminAnalytics';
import type { AdminGranularity, AdminOrder, AdminView, CustomerProfile } from '../types/admin';
import { formatCurrency, formatDateTime, formatPercent } from '../utils/formatters';
import { maskName } from '../utils/masking';
import { getAdminProductStatusLabel } from '../utils/productStatus';

export function Orders({
  todayRevenue,
  todayOrders,
  orders,
  mobileShare,
  timeSeries,
  granularityLabels,
  granularity,
  selectedRangeLabel,
  hourlyRows,
  channelRows,
  selectedOrder,
  selectedOrderCustomer,
  setSelectedCustomerId,
  setActiveView,
  allOrders,
  setSelectedOrderId
}: {
  todayRevenue: number;
  todayOrders: AdminOrder[];
  orders: AdminOrder[];
  mobileShare: number;
  timeSeries: ReturnType<typeof buildTimeSeries>;
  granularityLabels: Record<AdminGranularity, string>;
  granularity: AdminGranularity;
  selectedRangeLabel: string;
  hourlyRows: ReturnType<typeof buildHourlyRows>;
  channelRows: ReturnType<typeof buildChannelRows>;
  selectedOrder?: AdminOrder;
  selectedOrderCustomer?: CustomerProfile;
  setSelectedCustomerId: (customerId: string) => void;
  setActiveView: (view: AdminView) => void;
  allOrders: AdminOrder[];
  setSelectedOrderId: (orderId: string) => void;
}) {
  const activeView = 'orders' as const;
  const hasAnalyticsData = orders.some((order) => order.analyticsEstimated);

  return (
    <>
      {activeView === 'orders' ? (
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <span>결제 운영</span>
              <h2>주문 관리</h2>
            </div>
            <p>{hasAnalyticsData ? '주문번호, 유입, 기기, 금액, 리포트 생성 상태를 한 줄에서 확인합니다.' : '완료 리포트 기록과 카탈로그 가격을 표시하며 주문 원장·유입·기기는 미수집입니다.'}</p>
          </div>

          <div className="admin-insight-grid">
            <InsightCard title={hasAnalyticsData ? '오늘 매출' : '오늘 카탈로그 합계'} value={formatCurrency(todayRevenue)} body={hasAnalyticsData ? `${todayOrders.length}건의 결제 흐름` : `${todayOrders.length}건의 완료 리포트 기록`} icon={CalendarDays} tone="good" />
            <InsightCard title="대기 주문" value={hasAnalyticsData ? `${orders.filter((order) => order.status === 'pending').length}건` : '미수집'} body={hasAnalyticsData ? '결제 콜백 또는 리포트 생성 확인' : '실제 주문 원장이 필요합니다.'} icon={Clock} />
            <InsightCard title="실패 주문" value={hasAnalyticsData ? `${orders.filter((order) => order.status === 'failed').length}건` : '미수집'} body={hasAnalyticsData ? '결제 실패 콜백과 고객 안내 필요' : '실제 주문 원장이 필요합니다.'} icon={AlertTriangle} tone="warn" />
            <InsightCard title="모바일 결제" value={hasAnalyticsData ? formatPercent(mobileShare) : '미수집'} body={hasAnalyticsData ? '결제창 모바일 최적화 우선' : '기기 이벤트가 필요합니다.'} icon={MousePointerClick} />
          </div>

          <section className="admin-ops-grid">
            <RevenueTrendChart
              data={timeSeries}
              title={hasAnalyticsData ? `${granularityLabels[granularity]} 매출 흐름` : `${granularityLabels[granularity]} 카탈로그 합계 흐름`}
              rangeLabel={selectedRangeLabel}
            />
            <HourlyBarChart data={hourlyRows} isPaymentData={hasAnalyticsData} />
            <DonutChart title={hasAnalyticsData ? '유입 채널별 결제' : '출처 미수집 완료 리포트'} rows={channelRows} centerLabel={hasAnalyticsData ? '결제' : '기록'} />
          </section>

          <section className="admin-drilldown-layout">
            <OrderDetailPanel
              order={selectedOrder}
              customer={selectedOrderCustomer}
              onSelectCustomer={(customerId) => {
                setSelectedCustomerId(customerId);
                setActiveView('customers');
              }}
            />
            <CustomerDetailPanel
              profile={selectedOrderCustomer}
              orders={allOrders}
              onSelectOrder={(orderId) => setSelectedOrderId(orderId)}
            />
          </section>

          <div className="admin-data-table orders enhanced">
            <div className="admin-table-head">
              <span>시간</span>
              <span>주문번호</span>
              <span>고객</span>
              <span>상품</span>
              <span>유입</span>
              <span>기기</span>
              <span>{hasAnalyticsData ? '금액' : '카탈로그 가격'}</span>
              <span>상태</span>
            </div>
            {orders.map((order) => {
              const content = (
                <>
                  <span>{formatDateTime(order.createdAt)}</span>
                  <strong>{order.orderId}</strong>
                  <em>{maskName(order.customerName)}</em>
                  <p>
                    {order.productName}
                    <small className={`admin-product-status ${order.productStatus}`}>
                      {getAdminProductStatusLabel(order.productStatus)}
                    </small>
                  </p>
                  <span>{order.sourceChannel}</span>
                  <span>{order.device === 'mobile' ? '모바일' : order.device === 'desktop' ? '데스크톱' : '미수집'}</span>
                  <b>{formatCurrency(order.amount)}</b>
                  <div className="admin-pill-stack">
                    <small className={`admin-pill ${order.status}`}>{order.status}</small>
                    <small className={`admin-pill ${order.reportStatus}`}>{order.reportStatus}</small>
                  </div>
                </>
              );

              return (
                <button
                  key={order.id}
                  type="button"
                  className={selectedOrder?.id === order.id ? 'active' : ''}
                  onClick={() => setSelectedOrderId(order.id)}
                >
                  {content}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

    </>
  );
}
