import {
  CustomerDetailPanel,
  InsightCard,
  OrderDetailPanel
} from '../components';
import { filterCustomerProfiles, type buildCustomerSegments } from '../data/adminAnalytics';
import type {
  AdminOrder,
  AdminView,
  CustomerFilter,
  CustomerProfile
} from '../types/admin';
import { formatCurrency, formatDateTime } from '../utils/formatters';

export function Customers({
  customerSegments,
  customerProfiles,
  customerFilter,
  setCustomerFilter,
  setSelectedCustomerId,
  selectedCustomer,
  allOrders,
  setSelectedOrderId,
  setActiveView,
  selectedOrder,
  selectedOrderCustomer,
  filteredCustomerProfiles
}: {
  customerSegments: ReturnType<typeof buildCustomerSegments>;
  customerProfiles: CustomerProfile[];
  customerFilter: CustomerFilter;
  setCustomerFilter: (filter: CustomerFilter) => void;
  setSelectedCustomerId: (customerId: string) => void;
  selectedCustomer?: CustomerProfile;
  allOrders: AdminOrder[];
  setSelectedOrderId: (orderId: string) => void;
  setActiveView: (view: AdminView) => void;
  selectedOrder?: AdminOrder;
  selectedOrderCustomer?: CustomerProfile;
  filteredCustomerProfiles: CustomerProfile[];
}) {
  const activeView = 'customers' as const;
  const hasAnalyticsData = customerProfiles.some((profile) => profile.analyticsAvailable);

  return (
    <>
      {activeView === 'customers' ? (
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <span>고객 관리</span>
              <h2>{hasAnalyticsData ? '고객 정보와 재구매 가능성' : '리포트 고객 기록'}</h2>
            </div>
            <p>{hasAnalyticsData ? '카카오 로그인 고객은 개인정보를 마스킹하고, 상세 접근은 서버 권한 확인 후 열어야 합니다.' : '완료 리포트의 고객명만 마스킹해 표시하며 가입·인증·행동 정보는 미수집입니다.'}</p>
          </div>

          <div className="admin-insight-grid">
            {customerSegments.map((segment) => (
              <InsightCard key={segment.label} title={segment.label} value={`${segment.value}명`} body={segment.note} icon={segment.icon} tone={segment.label.includes('위험') ? 'warn' : 'good'} />
            ))}
          </div>

          <div className="admin-customer-filter-bar">
            {[
              { id: 'all' as const, label: hasAnalyticsData ? '전체 고객' : '리포트 고객', value: `${customerProfiles.length}명` },
              { id: 'registered' as const, label: hasAnalyticsData ? '가입 고객' : '가입 정보', value: hasAnalyticsData ? `${customerProfiles.filter((profile) => profile.status === 'registered').length}명` : '미수집' },
              { id: 'paid' as const, label: hasAnalyticsData ? '결제 고객' : '완료 리포트 고객', value: `${customerProfiles.filter((profile) => profile.paidOrders > 0).length}명` },
              { id: 'vip' as const, label: hasAnalyticsData ? 'VIP/재구매' : '반복 리포트', value: `${customerProfiles.filter((profile) => profile.segment === 'VIP' || profile.segment === '재구매 후보').length}명` },
              { id: 'risk' as const, label: hasAnalyticsData ? '이탈 위험' : '행동 분석', value: hasAnalyticsData ? `${customerProfiles.filter((profile) => profile.segment === '이탈 위험' || profile.segment === '가입만 완료' || profile.riskScore >= 65).length}명` : '미수집' }
            ].map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={customerFilter === filter.id ? 'active' : ''}
                onClick={() => {
                  setCustomerFilter(filter.id);
                  const nextProfile = filterCustomerProfiles(customerProfiles, filter.id)[0];
                  if (nextProfile) {
                    setSelectedCustomerId(nextProfile.id);
                  }
                }}
              >
                <span>{filter.label}</span>
                <strong>{filter.value}</strong>
              </button>
            ))}
          </div>

          <section className="admin-drilldown-layout">
            <CustomerDetailPanel
              profile={selectedCustomer}
              orders={allOrders}
              onSelectOrder={(orderId) => {
                setSelectedOrderId(orderId);
                setActiveView('orders');
              }}
            />
            <OrderDetailPanel
              order={selectedOrder}
              customer={selectedOrderCustomer}
              onSelectCustomer={(customerId) => setSelectedCustomerId(customerId)}
            />
          </section>

          <div className="admin-customer-grid">
            {filteredCustomerProfiles.map((customer) => (
              <button
                key={customer.id}
                type="button"
                className={selectedCustomer?.id === customer.id ? 'active' : ''}
                onClick={() => setSelectedCustomerId(customer.id)}
              >
                <div className="admin-avatar">{customer.maskedName.slice(0, 1)}</div>
                <div>
                  <strong>{customer.maskedName}</strong>
                  <span>{customer.email} · {customer.analyticsAvailable ? customer.segment : customer.segment === 'VIP' ? '반복 리포트' : '리포트 고객'}</span>
                </div>
                <dl>
                  <dt>상태</dt>
                  <dd>{customer.analyticsAvailable ? customer.status === 'paid' ? '결제' : '가입' : '리포트 기록'}</dd>
                  <dt>{customer.analyticsAvailable ? '구매' : '리포트'}</dt>
                  <dd>{customer.paidOrders}건</dd>
                  <dt>{customer.analyticsAvailable ? '누적' : '카탈로그 합계'}</dt>
                  <dd>{formatCurrency(customer.spent)}</dd>
                  <dt>열람</dt>
                  <dd>{customer.analyticsAvailable ? `${customer.readRate}%` : '미수집'}</dd>
                  <dt>최근</dt>
                  <dd>{formatDateTime(customer.lastSeen)}</dd>
                </dl>
                <p>{customer.lastProduct} · {customer.analyticsAvailable ? `위험도 ${customer.riskScore}점` : '행동 분석 미수집'}</p>
              </button>
            ))}
          </div>
        </section>
      ) : null}

    </>
  );
}
