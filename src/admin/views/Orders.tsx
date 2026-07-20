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

  return (
    <>
      {activeView === 'orders' ? (
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <span>결제 운영</span>
              <h2>주문 관리</h2>
            </div>
            <p>주문번호, 유입, 기기, 금액, 리포트 생성 상태를 한 줄에서 확인합니다.</p>
          </div>

          <div className="admin-insight-grid">
            <InsightCard title="오늘 매출" value={formatCurrency(todayRevenue)} body={`${todayOrders.length}건의 결제 흐름`} icon={CalendarDays} tone="good" />
            <InsightCard title="대기 주문" value={`${orders.filter((order) => order.status === 'pending').length}건`} body="결제 콜백 또는 리포트 생성 확인" icon={Clock} />
            <InsightCard title="실패 주문" value={`${orders.filter((order) => order.status === 'failed').length}건`} body="결제 실패 콜백과 고객 안내 필요" icon={AlertTriangle} tone="warn" />
            <InsightCard title="모바일 결제" value={formatPercent(mobileShare)} body="결제창 모바일 최적화 우선" icon={MousePointerClick} />
          </div>

          <section className="admin-ops-grid">
            <RevenueTrendChart
              data={timeSeries}
              title={`${granularityLabels[granularity]} 매출 흐름`}
              rangeLabel={selectedRangeLabel}
            />
            <HourlyBarChart data={hourlyRows} />
            <DonutChart title="유입 채널별 결제" rows={channelRows} centerLabel="결제" />
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
              <span>금액</span>
              <span>상태</span>
            </div>
            {orders.map((order) => {
              const content = (
                <>
                  <span>{formatDateTime(order.createdAt)}</span>
                  <strong>{order.orderId}</strong>
                  <em>{maskName(order.customerName)}</em>
                  <p>{order.productName}</p>
                  <span>{order.sourceChannel}</span>
                  <span>{order.device === 'mobile' ? '모바일' : '데스크톱'}</span>
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
